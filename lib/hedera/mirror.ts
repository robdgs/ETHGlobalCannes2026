import 'server-only';
import axios from "axios";

const BASE = process.env.HEDERA_NETWORK === "mainnet"
  ? "https://mainnet-public.mirrornode.hedera.com/api/v1"
  : "https://testnet.mirrornode.hedera.com/api/v1";

export function getMirrorBase() { return BASE; }

function decodeMsg(b64: string) {
  try { return JSON.parse(Buffer.from(b64, "base64").toString("utf8")); }
  catch { return { raw: Buffer.from(b64, "base64").toString("utf8") }; }
}

/**
 * Fetch recent HCS messages and enrich DOCUMENT_PROOF entries with their
 * corresponding HFS certificate file ID (from CERTIFICATE_LINK messages).
 *
 * We fetch 2× the requested limit so that CERTIFICATE_LINK messages —
 * which are published right after the corresponding DOCUMENT_PROOF — are
 * included in the same batch and can be joined in-memory.
 */
export async function getTopicMessages(limit = 25) {
  const topicId = (process.env.HCS_TOPIC_ID ?? "").trim();
  if (!topicId || !/^0\.0\.\d+$/.test(topicId)) return [];

  try {
    const fetchLimit = Math.min(limit * 2, 100);
    const { data } = await axios.get(
      `${BASE}/topics/${topicId}/messages?limit=${fetchLimit}&order=desc`,
      { timeout: 8000 },
    );

    const all = (data.messages ?? []).map((m: any) => ({
      sequenceNumber:     m.sequence_number,
      consensusTimestamp: m.consensus_timestamp,
      runningHash:        m.running_hash,
      message:            decodeMsg(m.message),
    }));

    // Build docHash → hfsFileId lookup from CERTIFICATE_LINK messages
    const certLinks = new Map<string, string>();
    for (const m of all) {
      if (
        m.message?.type === "CERTIFICATE_LINK" &&
        m.message?.docHash &&
        m.message?.hfsFileId
      ) {
        certLinks.set(m.message.docHash, m.message.hfsFileId);
      }
    }

    // Return only DOCUMENT_PROOF messages (or unknown types), enriched with hfsFileId
    return all
      .filter((m: any) => m.message?.type !== "CERTIFICATE_LINK")
      .slice(0, limit)
      .map((m: any) => ({
        ...m,
        message: {
          ...m.message,
          // null when no certificate has been uploaded for this document yet
          hfsFileId: m.message?.docHash
            ? (certLinks.get(m.message.docHash) ?? null)
            : null,
        },
      }));
  } catch { return []; }
}

export async function getTokenNFTs(limit = 25) {
  const tokenId = (process.env.HTS_TOKEN_ID ?? "").trim();
  if (!tokenId || !/^0\.0\.\d+$/.test(tokenId)) return [];
  try {
    const { data } = await axios.get(
      `${BASE}/tokens/${tokenId}/nfts?limit=${limit}&order=desc`,
      { timeout: 8000 },
    );
    return (data.nfts ?? []).map((n: any) => ({
      serialNumber:     n.serial_number,
      accountId:        n.account_id,
      createdTimestamp: n.created_timestamp,
      metadata: (() => {
        try { return JSON.parse(Buffer.from(n.metadata, "base64").toString("utf8")); }
        catch { return {}; }
      })(),
    }));
  } catch { return []; }
}

export async function verifyProof(docHash: string) {
  const messages = await getTopicMessages(100);
  return messages.find((m: any) =>
    m.message?.docHash === docHash ||
    m.message?.docHash?.startsWith(docHash.slice(0, 16))
  ) ?? null;
}

export async function getTokenInfo() {
  const tokenId = (process.env.HTS_TOKEN_ID ?? "").trim();
  if (!tokenId || !/^0\.0\.\d+$/.test(tokenId)) return null;
  try {
    const { data } = await axios.get(`${BASE}/tokens/${tokenId}`, { timeout: 8000 });
    return data;
  } catch { return null; }
}