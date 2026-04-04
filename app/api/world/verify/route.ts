/**
 * app/api/world/verify/route.ts
 * POST /api/world/verify
 *
 * Receives the IDKit result from the client and forwards it as-is to
 * World's developer verification endpoint.
 *
 * Body:  { idkitResponse: IDKitResult }
 * Reply: World API response (200 = verified, 400 = invalid proof)
 *
 * Docs: https://developer.world.org/api/v4/verify/{rp_id}
 */
import { NextRequest, NextResponse } from "next/server";
import type { IDKitResult } from "@worldcoin/idkit";

export async function POST(req: NextRequest) {
  try {
    const rpId = process.env.WORLD_RP_ID;
    if (!rpId) {
      return NextResponse.json(
        { error: "WORLD_RP_ID is not configured on the server." },
        { status: 503 },
      );
    }

    const body = await req.json();
    const idkitResponse: IDKitResult = body.idkitResponse ?? body;

    if (!idkitResponse) {
      return NextResponse.json({ error: "idkitResponse is required." }, { status: 400 });
    }

    // Forward the payload as-is — no field remapping needed for v4
    const worldRes = await fetch(
      `https://developer.world.org/api/v4/verify/${rpId}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(idkitResponse),
      },
    );

    const payload = await worldRes.json();

    if (!worldRes.ok) {
      console.error("[World ID] Verification failed:", payload);
      return NextResponse.json(
        { verified: false, error: payload?.detail ?? "Proof verification failed." },
        { status: worldRes.status },
      );
    }

    console.log("[World ID] Proof verified ✓", payload);
    return NextResponse.json({ verified: true, ...payload });
  } catch (err: any) {
    console.error("[World ID] verify error:", err);
    return NextResponse.json({ error: err.message ?? "Verification failed" }, { status: 500 });
  }
}