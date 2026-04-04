import "server-only";
/**
 * lib/hedera/hfs.ts — Hedera File Service
 *
 * Uploads and retrieves files from the Hedera File Service (HFS).
 * Files are immutable once created (no admin key = cannot be deleted/modified).
 * Max file size: 1024 KB. FileAppendTransaction handles chunking automatically.
 *
 * Docs: https://docs.hedera.com/hedera/sdks-and-apis/sdks/file-service
 */
import {
  FileCreateTransaction,
  FileAppendTransaction,
  FileContentsQuery,
  FileId,
  Hbar,
} from "@hashgraph/sdk";
import { getClient, getOperatorKey } from "./client";

export interface HFSUploadResult {
  fileId: string;
  transactionId: string;
  /** Bytes stored on-chain */
  size: number;
  /** Direct URL to view the certificate via our API */
  certificateUrl: string;
  /** HashScan explorer link */
  explorerUrl: string;
}

const HASHSCAN =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://hashscan.io"
    : "https://hashscan.io/testnet";

// FileCreateTransaction max safe initial content (6 KB per transaction)
const INITIAL_CHUNK = 6000;
// FileAppendTransaction default chunk size
const APPEND_CHUNK = 4096;

/**
 * Upload arbitrary content to HFS.
 * Uses FileCreateTransaction for the first chunk,
 * then FileAppendTransaction (with auto-chunking) for the remainder.
 *
 * @param content   UTF-8 string or Buffer
 * @param memo      Short description stored on-chain (max 100 chars)
 */
export async function uploadToHFS(
  content: Buffer | string,
  memo = "ProvenanceChain Certificate",
): Promise<HFSUploadResult> {
  const client = getClient();
  const operatorKey = getOperatorKey();
  const buf = Buffer.isBuffer(content) ? content : Buffer.from(content, "utf8");

  // Set expiration 1 year from now (files must be renewed to persist beyond this)
  const expirationTime = new Date();
  expirationTime.setFullYear(expirationTime.getFullYear() + 1);

  // ── Step 1: Create file with first chunk ─────────────────────────────────
  const firstChunk = buf.slice(0, Math.min(buf.length, INITIAL_CHUNK));

  const createTx = await new FileCreateTransaction()
    .setKeys([operatorKey.publicKey]) // operator can append/delete/renew
    .setContents(firstChunk)
    .setFileMemo(memo.slice(0, 100))
    .setMaxTransactionFee(new Hbar(5))
    .freezeWith(client)
    .sign(operatorKey);

  const createResponse = await createTx.execute(client);
  const createReceipt = await createResponse.getReceipt(client);
  const fileId = createReceipt.fileId!.toString();

  // ── Step 2: Append remaining content (SDK handles chunking automatically) ─
  if (buf.length > INITIAL_CHUNK) {
    const remaining = buf.slice(INITIAL_CHUNK);

    const appendTx = await new FileAppendTransaction()
      .setFileId(FileId.fromString(fileId))
      .setContents(remaining)
      .setChunkSize(APPEND_CHUNK)
      .setMaxTransactionFee(new Hbar(5))
      .freezeWith(client)
      .sign(operatorKey);

    await (await appendTx.execute(client)).getReceipt(client);
  }

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  return {
    fileId,
    transactionId: createResponse.transactionId.toString(),
    size: buf.length,
    certificateUrl: `${baseUrl}/api/certificate?fileId=${fileId}`,
    explorerUrl: `${HASHSCAN}/file/${fileId}`,
  };
}

/**
 * Read a file from HFS using the Hedera SDK FileContentsQuery.
 * Returns raw Buffer — caller decides how to interpret the content.
 */
export async function readFromHFS(fileId: string): Promise<Buffer> {
  const client = getClient();

  const contents = await new FileContentsQuery()
    .setFileId(FileId.fromString(fileId))
    .execute(client);

  return Buffer.from(contents as Uint8Array);
}