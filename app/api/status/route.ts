/**
 * app/api/unlink/status/route.ts
 * GET /api/unlink/status
 */
import { NextResponse } from "next/server";
import { getUnlinkClient, SUBMISSION_FEE_WEI, UNLINK_CHAINS, UNLINK_CHAIN_ID, UNLINK_TEST_TOKEN } from "@/lib/unlink/client";

export async function GET() {
  const client = getUnlinkClient();

  return NextResponse.json({
    live:             client.isLive,
    mode:             client.isLive ? "live" : "simulation",
    chain:            client.chain,
    chainId:          UNLINK_CHAIN_ID,
    supportedChains:  UNLINK_CHAINS,
    network:          "Base Sepolia",
    tokenAddress:     UNLINK_TEST_TOKEN,
    submissionFeeWei: SUBMISSION_FEE_WEI.toString(),
    submissionFeeEth: (Number(SUBMISSION_FEE_WEI) / 1e18).toFixed(4) + " tokens",
    receiverAddress:  process.env.UNLINK_RECEIVER_ADDRESS ?? "not-set",
    apiUrl:           "https://staging-api.unlink.xyz",
    faucet:           "https://hackaton-apikey.vercel.app/faucet",
    docs:             "https://docs.unlink.xyz",
    setup: client.isLive
      ? "✓ Live mode active"
      : [
          "1. Get API key: https://hackaton-apikey.vercel.app",
          "2. Set UNLINK_API_KEY in .env.local",
          "3. Set UNLINK_OPERATOR_PRIVATE_KEY (0x + 64 hex chars, funded on Base Sepolia)",
          "4. Set UNLINK_USER_MNEMONIC (12 BIP39 words)",
          "5. Set UNLINK_LIVE_MODE=true",
          "6. Get test tokens: https://hackaton-apikey.vercel.app/faucet",
        ],
  });
}