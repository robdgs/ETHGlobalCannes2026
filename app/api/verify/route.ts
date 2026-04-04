/**
 * app/api/verify/route.ts
 *
 * GET /api/verify?hash=... — Search for a document proof on Hedera by docHash
 * POST /api/verify — Forward World ID verification (for backward compat)
 */
import { NextRequest, NextResponse } from "next/server";
import { verifyProof } from "@/lib/hedera/mirror";
import { getMirrorBase } from "@/lib/hedera/mirror";

export async function POST(req: NextRequest) {
  try {
    const rpId = process.env.WORLD_RP_ID;
    const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;

    if (!rpId && !appId) {
      return NextResponse.json(
        {
          error:
            "Neither WORLD_RP_ID nor NEXT_PUBLIC_WORLD_APP_ID is configured.",
        },
        { status: 503 },
      );
    }

    const body = await req.json();
    // Accept either { idkitResponse: ... } or the payload directly
    const idkitResponse = body.idkitResponse ?? body;

    if (!idkitResponse) {
      return NextResponse.json(
        { error: "idkitResponse is required." },
        { status: 400 },
      );
    }

    // v4 endpoint uses rp_id; fall back to app_id for backward compat
    const identifier = rpId ?? appId;
    const verifyUrl = `https://developer.world.org/api/v4/verify/${identifier}`;

    console.log("[World ID] Forwarding proof to:", verifyUrl);
    console.log("[World ID] Payload keys:", Object.keys(idkitResponse));

    const worldRes = await fetch(verifyUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(idkitResponse),
    });

    const payload = await worldRes.json();

    // Log the full response so you can see World's exact error message
    console.log(
      `[World ID] Response ${worldRes.status}:`,
      JSON.stringify(payload, null, 2),
    );

    if (!worldRes.ok) {
      return NextResponse.json(
        {
          verified: false,
          error:
            payload?.detail ?? payload?.message ?? "Proof verification failed.",
          raw: payload, // included so the client can show the real error
        },
        { status: worldRes.status },
      );
    }

    return NextResponse.json({ verified: true, ...payload });
  } catch (err: any) {
    console.error("[World ID] verify error:", err);
    return NextResponse.json(
      { error: err.message ?? "Verification failed" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/verify?hash=<docHash>
 * Search for a document proof on Hedera by its SHA-256 hash
 */
export async function GET(req: NextRequest) {
  const docHash = req.nextUrl.searchParams.get("hash")?.trim();

  if (!docHash || !/^[0-9a-f]{64}$/i.test(docHash)) {
    return NextResponse.json(
      {
        verified: false,
        message: "Invalid hash. Must be 64-character hex SHA-256.",
      },
      { status: 400 },
    );
  }

  try {
    const proof = await verifyProof(docHash);

    if (!proof) {
      return NextResponse.json({
        verified: false,
        message: "No proof found for this hash on Hedera.",
      });
    }

    const mirrorBase = getMirrorBase();
    const topicId = (process.env.HCS_TOPIC_ID ?? "").trim();

    return NextResponse.json({
      verified: true,
      proof,
      mirrorUrl: topicId
        ? `${mirrorBase}/topics/${topicId}/messages?sequenceNumber=${proof.sequenceNumber}`
        : null,
    });
  } catch (err: any) {
    console.error("[Verify] Error:", err);
    return NextResponse.json(
      { verified: false, message: err.message ?? "Verification failed" },
      { status: 500 },
    );
  }
}
