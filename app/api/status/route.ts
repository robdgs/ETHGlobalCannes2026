/**
 * app/api/status/route.ts
 * GET /api/status
 *
 * Returns Hedera network configuration and statistics (topic ID, token ID, count of minted proofs).
 * Used by dashboard and header components to display on-chain metrics.
 */
import { NextResponse } from "next/server";
import { validateHederaEnv } from "@/lib/hedera/validate";
import { getTopicMessages, getTokenInfo } from "@/lib/hedera/mirror";

export async function GET() {
  const validation = validateHederaEnv();

  // If Hedera is not configured, return error status
  if (!validation.ok) {
    return NextResponse.json({
      status: "misconfigured",
      errors: validation.errors,
      topicId: null,
      tokenId: null,
      totalMinted: 0,
    });
  }

  try {
    const topicId = (process.env.HCS_TOPIC_ID ?? "").trim();
    const tokenId = (process.env.HTS_TOKEN_ID ?? "").trim();

    // Fetch recent messages to count total minted proofs
    const messages = await getTopicMessages(1000);
    const totalMinted = messages.length;

    // Optionally fetch token info for name/metadata
    const tokenInfo = tokenId ? await getTokenInfo() : null;

    return NextResponse.json({
      status: "configured",
      network: process.env.HEDERA_NETWORK ?? "testnet",
      topicId,
      tokenId,
      tokenName: tokenInfo?.name ?? "ProvenanceChain",
      totalMinted,
    });
  } catch (err: any) {
    console.error("[Status] Error:", err);
    return NextResponse.json(
      {
        status: "error",
        network: process.env.HEDERA_NETWORK ?? "testnet",
        topicId: (process.env.HCS_TOPIC_ID ?? "").trim(),
        tokenId: (process.env.HTS_TOKEN_ID ?? "").trim(),
        totalMinted: 0,
        error: err.message,
      },
      { status: 500 },
    );
  }
}
