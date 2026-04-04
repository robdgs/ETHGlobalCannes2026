/**
 * app/api/unlink/status/route.ts
 * GET /api/unlink/status — returns Unlink config and chain info
 */
import { NextResponse } from "next/server";
import { getUnlinkClient, SUBMISSION_FEE_WEI, UNLINK_CHAINS } from "@/lib/unlink/client";

export async function GET() {
  const client = getUnlinkClient();
  return NextResponse.json({
    live:              client.isLive,
    chain:             client.chain,
    chainId:           parseInt(process.env.UNLINK_CHAIN_ID ?? "137"),
    supportedChains:   UNLINK_CHAINS,
    submissionFeeWei:  SUBMISSION_FEE_WEI.toString(),
    submissionFeeEth:  (Number(SUBMISSION_FEE_WEI) / 1e18).toFixed(4),
    receiverAddress:   process.env.UNLINK_RECEIVER_ADDRESS ?? "not-set",
    mode:              client.isLive ? "live" : "simulation",
  });
}
