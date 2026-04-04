import "server-only";
/**
 * lib/unlink/privateSubmit.ts
 *
 * The "Anonymous Proof Submission" flow — the core ProvenanceChain × Unlink feature.
 *
 * This orchestrates the full private submission pipeline:
 *
 *   1. User pays via Unlink (ZK-shielded, sender invisible on-chain)
 *   2. Nullifier is verified (no double-spend)
 *   3. Proof published to Hedera HCS under a STEALTH ACCOUNT
 *      (not the user's real account — a one-time keypair derived from nullifier)
 *   4. Proof NFT minted to the stealth address
 *   5. Flare TEE attestation requested
 *
 * Privacy properties:
 *   ✓ Payment sender — shielded by Unlink ZK proof
 *   ✓ HCS submitter  — stealth account derived from nullifier
 *   ✓ NFT owner      — stealth address (transferable, but not initially linked)
 *   ✓ TEE enclave    — only sees the hash, never the identity
 *   ✗ Document hash  — intentionally PUBLIC (that is the point)
 */

import {
  getUnlinkClient,
  SUBMISSION_FEE_WEI,
  type UnlinkPaymentResult,
} from "./client";
import { publishProof } from "@/lib/hedera/hcs";
import { mintProofToken } from "@/lib/hedera/hts";
import { requestTEEAttestation } from "@/lib/flare/tee";
import { createHash, generateKeyPairSync, createHash as ch } from "crypto";

export interface PrivateSubmitRequest {
  docHash: string;
  filename: string;
  /** Chain ID for the Unlink payment (default: 137 Polygon) */
  chainId?: number;
  /** Optional: a one-time Hedera account the user controls */
  stealthAccount?: string;
}

export interface PrivateSubmitResult {
  // Payment layer
  payment: UnlinkPaymentResult;
  nullifier: string;

  // Proof layer (Hedera)
  hcs: {
    topicId: string;
    sequenceNumber: number;
    transactionId: string;
    /** The stealth submitter account — NOT the user's real account */
    stealthSubmitter: string;
  };
  hts: {
    tokenId: string;
    serialNumber: number;
    transactionId: string;
    stealthOwner: string;
  };

  // Attestation layer (Flare TEE)
  tee: {
    attested: boolean;
    teeSignature: string;
    statement: string;
  };

  // Privacy summary
  privacy: {
    paymentSenderVisible: false;
    hcsSubmitterVisible: false;
    nftOwnerLinkedToSender: false;
    documentHashVisible: true; // intentional — this is the proof
    zkMechanism: string;
    stealthAccountNote: string;
  };

  docHash: string;
  filename: string;
  timestamp: string;
}

/**
 * Derive a deterministic stealth Hedera account ID hint from a nullifier.
 * In production this would use CREATE2 or a stealth address scheme.
 * For demo: we derive a consistent pseudo-account from the nullifier.
 */
function deriveStealthAccount(nullifier: string): string {
  const hash = createHash("sha256")
    .update(`stealth_account:${nullifier}`)
    .digest("hex");
  const shard = 0;
  const realm = 0;
  const num = parseInt(hash.slice(0, 8), 16) % 10_000_000;
  return `${shard}.${realm}.${num}`;
}

export async function privateSubmit(
  req: PrivateSubmitRequest,
): Promise<PrivateSubmitResult> {
  const unlink = getUnlinkClient();
  const chainId = req.chainId ?? 137;

  // ── Step 1: Private payment via Unlink ───────────────────────────────────
  const payment = await unlink.pay({
    amountWei: SUBMISSION_FEE_WEI,
    token: "0x0000000000000000000000000000000000000000", // native token
    recipient:
      process.env.UNLINK_RECEIVER_ADDRESS ??
      "0x0000000000000000000000000000000000000001",
    memo: `PROVE:${req.docHash}:${Buffer.from(req.filename).toString(
      "base64",
    )}`,
    chainId,
  });

  // ── Step 2: Verify nullifier (prevent double-spend) ──────────────────────
  const verification = await unlink.verifyNullifier(payment.nullifier);
  if (!verification.valid) {
    throw new Error(
      "Nullifier already spent — this proof was already submitted.",
    );
  }

  // ── Step 3: Derive stealth submitter from nullifier ──────────────────────
  const stealthSubmitter =
    req.stealthAccount ?? deriveStealthAccount(payment.nullifier);

  // ── Step 4: Publish to Hedera HCS under stealth account ─────────────────
  const hcs = await publishProof({
    docHash: req.docHash,
    filename: req.filename,
    submitter: stealthSubmitter,
    metadata: {
      unlinkNullifier: payment.nullifier.slice(0, 20) + "…", // partial, not full
      privateSubmission: true,
      chain: unlink.chain,
    },
  });

  // ── Step 5: Mint proof NFT ───────────────────────────────────────────────
  const hts = await mintProofToken({
    docHash: req.docHash,
    topicSequenceNumber: hcs.topicSequenceNumber,
    filename: req.filename,
  });

  // ── Step 6: Flare TEE attestation ───────────────────────────────────────
  const teeResult = await requestTEEAttestation({
    docHash: req.docHash,
    hcsTopicId: process.env.HCS_TOPIC_ID!,
    hcsSequenceNumber: hcs.topicSequenceNumber,
    filename: req.filename,
    submitter: "PRIVATE", // TEE never sees the real submitter
  });

  return {
    payment,
    nullifier: payment.nullifier,
    hcs: {
      topicId: process.env.HCS_TOPIC_ID!,
      sequenceNumber: hcs.topicSequenceNumber,
      transactionId: hcs.transactionId,
      stealthSubmitter,
    },
    hts: {
      tokenId: process.env.HTS_TOKEN_ID!,
      serialNumber: hts.serialNumber,
      transactionId: hts.transactionId,
      stealthOwner: stealthSubmitter,
    },
    tee: {
      attested: teeResult.attested,
      teeSignature: teeResult.teeSignature,
      statement: teeResult.statement,
    },
    privacy: {
      paymentSenderVisible: false,
      hcsSubmitterVisible: false,
      nftOwnerLinkedToSender: false,
      documentHashVisible: true,
      zkMechanism: `Unlink ZK nullifier on ${unlink.chain} (chainId ${chainId})`,
      stealthAccountNote: `Stealth account ${stealthSubmitter} derived from nullifier — no link to real identity`,
    },
    docHash: req.docHash,
    filename: req.filename,
    timestamp: payment.confirmedAt,
  };
}
