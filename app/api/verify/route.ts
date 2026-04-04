import { NextRequest, NextResponse } from "next/server";
import { requireHederaEnv }         from "@/lib/hedera/validate";
import { verifyProof, getMirrorBase } from "@/lib/hedera/mirror";

export async function GET(req: NextRequest) {
  try { requireHederaEnv(); } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }

  const hash = req.nextUrl.searchParams.get("hash")?.trim();
  if (!hash || !/^[0-9a-f]{64}$/i.test(hash)) {
    return NextResponse.json({ error: "?hash= must be a 64-character hex SHA-256 string." }, { status: 400 });
  }

  try {
    const proof = await verifyProof(hash);
    if (!proof) return NextResponse.json({ verified: false, message: "No matching proof found on chain." });
    return NextResponse.json({
      verified: true, proof,
      topicId:  process.env.HCS_TOPIC_ID,
      mirrorUrl:`${getMirrorBase()}/topics/${process.env.HCS_TOPIC_ID}/messages/${proof.sequenceNumber}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
