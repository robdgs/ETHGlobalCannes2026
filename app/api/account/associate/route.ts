/**
 * app/api/account/associate/route.ts
 * POST /api/account/associate
 */
import { NextRequest, NextResponse } from "next/server";
import { associateWithToken } from "@/lib/hedera/account";

export async function POST(req: NextRequest) {
  try {
    const { accountId, privateKey } = await req.json();
    if (!accountId || !privateKey) {
      return NextResponse.json({ error: "accountId and privateKey are required." }, { status: 400 });
    }
    const result = await associateWithToken(accountId, privateKey);
    return NextResponse.json({
      success: true,
      accountId,
      tokenId: process.env.HTS_TOKEN_ID,
      ...result,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
