import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireHederaEnv } from "@/lib/hedera/validate";
import { publishProof }   from "@/lib/hedera/hcs";
import { mintProofToken } from "@/lib/hedera/hts";
import { scheduleReward } from "@/lib/hedera/schedule";

const HASHSCAN = process.env.HEDERA_NETWORK === "mainnet"
  ? "https://hashscan.io" : "https://hashscan.io/testnet";

export async function POST(req: NextRequest) {
  // Validate env before touching the SDK — gives clear error instead of "failed to parse entity id"
  try { requireHederaEnv(); } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }

  try {
    const formData       = await req.formData();
    const file           = formData.get("file") as File | null;
    const text           = formData.get("text") as string | null;
    const submitter      = (formData.get("submitter")      as string | null)?.trim() || "";
    const paymentTxHash  = (formData.get("paymentTxHash")  as string | null) || null;
    const payerAddress   = (formData.get("payerAddress")   as string | null) || null;
    const paymentNetwork = (formData.get("paymentNetwork") as string | null) || null;
    const isPrivate      = formData.get("isPrivate") === "true";

    if (!file && !text) {
      return NextResponse.json({ error: "Provide a file or text." }, { status: 400 });
    }
    if (!paymentTxHash) {
      return NextResponse.json(
        { error: "paymentTxHash is required. Complete the wallet payment first." },
        { status: 400 }
      );
    }

    const buffer   = file ? Buffer.from(await file.arrayBuffer()) : Buffer.from(text!, "utf8");
    const filename = file?.name ?? "text-submission.txt";
    const docHash  = createHash("sha256").update(buffer).digest("hex");

    console.log(`📄 ${isPrivate ? "🔒 PRIVATE" : "PUBLIC"} submission: ${filename} (${docHash.slice(0,12)}…)`);

    const stealthSubmitter = isPrivate
      ? `0.0.${Math.abs(parseInt(payerAddress?.slice(2,10) ?? "0", 16)) % 9_000_000 + 1_000_000}`
      : (submitter || process.env.HEDERA_OPERATOR_ID!);

    const hcs = await publishProof({
      docHash, filename,
      submitter: stealthSubmitter,
      metadata: {
        paymentTxHash,
        payerAddress:  isPrivate ? "[PRIVATE]" : payerAddress,
        paymentNetwork,
        privateSubmission: isPrivate,
      },
    });

    const hts = await mintProofToken({
      docHash,
      topicSequenceNumber: hcs.topicSequenceNumber,
      filename,
    });

    let schedule = null;
    try {
      schedule = await scheduleReward(
        isPrivate ? process.env.HEDERA_OPERATOR_ID! : (submitter || process.env.HEDERA_OPERATOR_ID!),
        500_000,
        `ProvenanceChain reward — ${filename}`
      );
    } catch (e: any) {
      console.warn("Schedule skipped:", e.message);
    }

    return NextResponse.json({
      success: true, docHash, filename, paymentTxHash,
      payerAddress: isPrivate ? "[PRIVATE]" : payerAddress,
      isPrivate,
      hcs: {
        topicId:        process.env.HCS_TOPIC_ID,
        sequenceNumber: hcs.topicSequenceNumber,
        transactionId:  hcs.transactionId,
        submitter:      stealthSubmitter,
      },
      hts: {
        tokenId:       process.env.HTS_TOKEN_ID,
        serialNumber:  hts.serialNumber,
        transactionId: hts.transactionId,
      },
      schedule: schedule ? { scheduleId: schedule.scheduleId, transactionId: schedule.transactionId } : null,
      explorerLinks: {
        hcsTopic: `${HASHSCAN}/topic/${process.env.HCS_TOPIC_ID}`,
        nftToken: `${HASHSCAN}/token/${process.env.HTS_TOKEN_ID}`,
        hcsTx:    `${HASHSCAN}/transaction/${encodeURIComponent(hcs.transactionId)}`,
        nftTx:    `${HASHSCAN}/transaction/${encodeURIComponent(hts.transactionId)}`,
      },
    });
  } catch (err: any) {
    console.error("Submit error:", err);
    return NextResponse.json({ error: err.message ?? "Internal error" }, { status: 500 });
  }
}
