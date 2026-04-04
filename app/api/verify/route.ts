/**
 * app/api/world/verify/route.ts
 * POST /api/world/verify
 *
 * Forwards the IDKit result as-is to World's v4 verification endpoint.
 * Falls back to app_id URL if WORLD_RP_ID is not configured.
 */
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const rpId  = process.env.WORLD_RP_ID;
    const appId = process.env.NEXT_PUBLIC_WORLD_APP_ID;

    if (!rpId && !appId) {
      return NextResponse.json(
        { error: "Neither WORLD_RP_ID nor NEXT_PUBLIC_WORLD_APP_ID is configured." },
        { status: 503 },
      );
    }

    const body = await req.json();
    // Accept either { idkitResponse: ... } or the payload directly
    const idkitResponse = body.idkitResponse ?? body;

    if (!idkitResponse) {
      return NextResponse.json({ error: "idkitResponse is required." }, { status: 400 });
    }

    // v4 endpoint uses rp_id; fall back to app_id for backward compat
    const identifier = rpId ?? appId;
    const verifyUrl  = `https://developer.world.org/api/v4/verify/${identifier}`;

    console.log("[World ID] Forwarding proof to:", verifyUrl);
    console.log("[World ID] Payload keys:", Object.keys(idkitResponse));

    const worldRes = await fetch(verifyUrl, {
      method:  "POST",
      headers: { "content-type": "application/json" },
      body:    JSON.stringify(idkitResponse),
    });

    const payload = await worldRes.json();

    // Log the full response so you can see World's exact error message
    console.log(`[World ID] Response ${worldRes.status}:`, JSON.stringify(payload, null, 2));

    if (!worldRes.ok) {
      return NextResponse.json(
        {
          verified: false,
          error:    payload?.detail ?? payload?.message ?? "Proof verification failed.",
          raw:      payload,          // included so the client can show the real error
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