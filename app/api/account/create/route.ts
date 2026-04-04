/**
 * app/api/account/create/route.ts
 * POST /api/account/create
 */
import { NextRequest, NextResponse } from "next/server";
import { createAccount } from "@/lib/hedera/account";

const HASHSCAN =
  process.env.HEDERA_NETWORK === "mainnet"
    ? "https://hashscan.io"
    : "https://hashscan.io/testnet";

export async function POST(req: NextRequest) {
  try {
    const body         = await req.json().catch(() => ({}));
    const initialHbar  = Math.min(Number(body.initialHbar) || 5, 10);

    const result = await createAccount(initialHbar);

    return NextResponse.json({
      ...result,
      explorerLink: `${HASHSCAN}/account/${result.accountId}`,
      warning: "Private key shown for demo purposes only. In production, generate keys client-side.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
