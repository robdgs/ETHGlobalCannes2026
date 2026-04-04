import { NextResponse } from "next/server";
import { validateHederaEnv } from "@/lib/hedera/validate";
import { getTokenInfo }     from "@/lib/hedera/mirror";

export async function GET() {
  const { ok, errors } = validateHederaEnv();

  if (!ok) {
    return NextResponse.json({
      status:   "misconfigured",
      errors,
      fix:      "Copy .env.local.example → .env.local, fill in credentials, run: npm run setup",
      network:  process.env.HEDERA_NETWORK || "testnet",
      topicId:  process.env.HCS_TOPIC_ID  || null,
      tokenId:  process.env.HTS_TOKEN_ID  || null,
    });
  }

  try {
    const tokenInfo = await getTokenInfo();
    return NextResponse.json({
      status:      "ok",
      network:     process.env.HEDERA_NETWORK || "testnet",
      topicId:     process.env.HCS_TOPIC_ID,
      tokenId:     process.env.HTS_TOKEN_ID,
      tokenName:   tokenInfo?.name,
      totalMinted: tokenInfo?.total_supply,
    });
  } catch {
    return NextResponse.json({
      status:  "ok",
      network: process.env.HEDERA_NETWORK || "testnet",
      topicId: process.env.HCS_TOPIC_ID || null,
      tokenId: process.env.HTS_TOKEN_ID || null,
    });
  }
}
