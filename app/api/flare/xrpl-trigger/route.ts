/**
 * app/api/flare/xrpl-trigger/route.ts
 *
 * POST /api/flare/xrpl-trigger
 *
 * Simulates (or relays) an XRPL payment that triggers the Flare Smart Account
 * to orchestrate the full ProvenanceChain flow.
 *
 * In production, the FDC / XRPL bridge calls the Smart Account automatically
 * when a payment arrives. This endpoint provides the "Pay-to-Prove" UX:
 * build the XRPL memo, simulate the Smart Account call, and (if live) run
 * the full Hedera + TEE proof pipeline on behalf of the XRPL user.
 *
 * Body:
 *   { xrplSender, amountXRP, docHash, filename }
 *   OR
 *   { xrplSender, amountXRP, memoHex }   (raw XRPL memo hex)
 */
import { NextRequest, NextResponse } from "next/server";
import { parseXRPLMemo, triggerSmartAccount, buildXRPLMemo } from "@/lib/flare/smartAccount";
import { getRewardPricing } from "@/lib/flare/ftso";
import { createHash } from "crypto";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { xrplSender, amountXRP, docHash, filename, memoHex, text } = body;

    if (!xrplSender) {
      return NextResponse.json({ error: "xrplSender is required." }, { status: 400 });
    }

    // Parse memo — either raw hex or docHash + filename
    let memo;
    if (memoHex) {
      memo = parseXRPLMemo(memoHex, xrplSender, Math.round((amountXRP ?? 1) * 1e6));
    } else if (docHash) {
      const hex = buildXRPLMemo(docHash, filename ?? "unknown");
      memo = parseXRPLMemo(hex, xrplSender, Math.round((amountXRP ?? 1) * 1e6));
    } else if (text) {
      // Hash the text client-side equivalent
      const hash = createHash("sha256").update(text).digest("hex");
      const hex  = buildXRPLMemo(hash, "text-submission.txt");
      memo = parseXRPLMemo(hex, xrplSender, Math.round((amountXRP ?? 1) * 1e6));
    } else {
      return NextResponse.json({ error: "Provide docHash + filename, memoHex, or text." }, { status: 400 });
    }

    if (!memo.valid) {
      return NextResponse.json({ error: memo.error ?? "Invalid memo." }, { status: 400 });
    }

    // Get FTSO pricing
    const pricing = await getRewardPricing();

    // Trigger Smart Account (live or simulation)
    const result = await triggerSmartAccount(memo);

    // Build the XRPL memo for the user's wallet
    const xrplMemoHex = buildXRPLMemo(memo.docHash, memo.filename);

    return NextResponse.json({
      success:      true,
      smartAccount: result,
      pricing,
      xrplInstructions: {
        destinationAddress: process.env.XRPL_SMART_ACCOUNT_ADDRESS ?? "rXXXXXXXXXXXXXXXXXXXXXXXX",
        memoHex:            xrplMemoHex,
        memoDecoded:        `PROVE:${memo.docHash}:${Buffer.from(memo.filename).toString("base64")}`,
        minimumXRP:         pricing.xrpEquivalent,
        note:               `Send ≥${pricing.xrpEquivalent} XRP with this memo to trigger ProvenanceChain from XRPL`,
      },
    });
  } catch (err: any) {
    console.error("XRPL trigger error:", err);
    return NextResponse.json({ error: err.message ?? "Smart Account trigger failed" }, { status: 500 });
  }
}

/**
 * GET /api/flare/xrpl-trigger?docHash=...&filename=...
 * Returns the XRPL memo a user needs to include in their payment.
 */
export async function GET(req: NextRequest) {
  const docHash  = req.nextUrl.searchParams.get("docHash");
  const filename = req.nextUrl.searchParams.get("filename") ?? "document";

  if (!docHash || !/^[0-9a-f]{64}$/i.test(docHash)) {
    return NextResponse.json({ error: "Valid docHash required." }, { status: 400 });
  }

  const memoHex = buildXRPLMemo(docHash, filename);
  const pricing = await getRewardPricing();

  return NextResponse.json({
    memoHex,
    memoDecoded:        `PROVE:${docHash}:${Buffer.from(filename).toString("base64")}`,
    destinationAddress: process.env.XRPL_SMART_ACCOUNT_ADDRESS ?? "rXXXXXXXXXXXXXXXXXXXXXXXX",
    minimumXRP:         pricing.xrpEquivalent,
    pricing,
  });
}
