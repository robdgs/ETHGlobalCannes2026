/**
 * app/api/world/sign/route.ts
 * POST /api/world/sign
 *
 * Generates an RP signature for IDKit. Called client-side before opening
 * the World ID widget. The RP_SIGNING_KEY is never sent to the browser.
 *
 * Body:  { action: string }
 * Reply: { sig, nonce, created_at, expires_at }
 */
import { NextRequest, NextResponse } from "next/server";
import { signRequest } from "@worldcoin/idkit/signing";

export async function POST(req: NextRequest) {
  try {
    const { action } = await req.json();

    if (!action || typeof action !== "string") {
      return NextResponse.json({ error: "action is required." }, { status: 400 });
    }

    const signingKey = process.env.RP_SIGNING_KEY;
    if (!signingKey) {
      return NextResponse.json(
        { error: "RP_SIGNING_KEY is not configured on the server." },
        { status: 503 },
      );
    }

    const { sig, nonce, createdAt, expiresAt } = signRequest(action, signingKey);

    return NextResponse.json({
      sig,
      nonce,
      created_at: createdAt,
      expires_at: expiresAt,
    });
  } catch (err: any) {
    console.error("[World ID] sign error:", err);
    return NextResponse.json({ error: err.message ?? "Signing failed" }, { status: 500 });
  }
}