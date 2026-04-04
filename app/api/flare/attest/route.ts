/**
 * app/api/flare/attest/route.ts
 *
 * POST /api/flare/attest
 *
 * Request a Flare TEE attestation for an existing HCS proof.
 * The TEE independently fetches the proof from Mirror Node, verifies
 * the document hash, and returns a signed attestation result.
 *
 * Body: { docHash, hcsTopicId, hcsSequenceNumber, filename, submitter? }
 */
import { NextRequest, NextResponse } from "next/server";
import { requestTEEAttestation } from "@/lib/flare/tee";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { docHash, hcsTopicId, hcsSequenceNumber, filename, submitter } = body;

    if (!docHash || !hcsTopicId || hcsSequenceNumber === undefined) {
      return NextResponse.json(
        { error: "docHash, hcsTopicId, and hcsSequenceNumber are required." },
        { status: 400 }
      );
    }

    if (!/^[0-9a-f]{64}$/i.test(docHash)) {
      return NextResponse.json({ error: "Invalid docHash." }, { status: 400 });
    }

    const attestation = await requestTEEAttestation({
      docHash,
      hcsTopicId:        hcsTopicId || process.env.HCS_TOPIC_ID!,
      hcsSequenceNumber: Number(hcsSequenceNumber),
      filename:          filename || "unknown",
      submitter,
    });

    return NextResponse.json({ success: true, attestation });
  } catch (err: any) {
    console.error("TEE attest error:", err);
    return NextResponse.json({ error: err.message ?? "TEE attestation failed" }, { status: 500 });
  }
}
