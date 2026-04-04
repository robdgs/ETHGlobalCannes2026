import 'server-only';
/**
 * lib/flare/ftso.ts — Flare Time Series Oracle (FTSO v2)
 *
 * Uses the IFtsoV2 interface on Flare to fetch current price feeds.
 * We query HBAR/USD so we can dynamically price rewards in USD terms,
 * and XRP/USD for the XRPL Smart Account pay-to-prove flow.
 *
 * Contract: FastUpdater (FTSO v2) on Coston2
 *   Address: 0x70e8C12137680faB9400b6c9E33E7ba83c947A8b
 *
 * Docs: https://dev.flare.network/ftso/overview
 */

import { Contract, Interface } from "ethers";
import { getFlareProvider } from "./client";

// Minimal ABI — only the functions we need
const FTSO_ABI = [
  "function getFeedById(bytes21 _feedId) external view returns (uint256 _value, int8 _decimals, uint64 _timestamp)",
  "function getFeedByName(string _feedName) external view returns (uint256 _value, int8 _decimals, uint64 _timestamp)",
];

// FastUpdater address on Coston2 testnet
const FAST_UPDATER_ADDRESS = "0x70e8C12137680faB9400b6c9E33E7ba83c947A8b";

// Feed IDs (bytes21, left-padded category byte 0x01 = crypto)
// Format: 0x01 + right-padded ASCII of "HBAR/USD" etc.
const FEED_IDS: Record<string, string> = {
  "XRP/USD":  "0x015852502f55534400000000000000000000000000",
  "HBAR/USD": "0x01484241522f555344000000000000000000000000",
  "ETH/USD":  "0x014554482f55534400000000000000000000000000",
  "FLR/USD":  "0x01464c522f55534400000000000000000000000000",
};

export interface FTSOPrice {
  feed:      string;
  value:     number;
  decimals:  number;
  timestamp: number;
  usd:       string; // human-readable e.g. "$0.0842"
}

/**
 * Fetch a price from FTSO v2.
 * Falls back to a cached mock when the RPC is unavailable (dev / CI).
 */
export async function getFTSOPrice(feed: keyof typeof FEED_IDS): Promise<FTSOPrice> {
  try {
    const provider = getFlareProvider();
    const contract = new Contract(FAST_UPDATER_ADDRESS, FTSO_ABI, provider);
    const feedId   = FEED_IDS[feed];
    if (!feedId) throw new Error(`Unknown feed: ${feed}`);

    const [rawValue, decimals, timestamp] = await contract.getFeedById(feedId);
    const value = Number(rawValue) / Math.pow(10, Number(decimals));

    return {
      feed,
      value,
      decimals: Number(decimals),
      timestamp: Number(timestamp),
      usd: `$${value.toFixed(4)}`,
    };
  } catch {
    // Fallback mock prices for dev/test environments without live RPC
    const mocks: Record<string, number> = {
      "XRP/USD":  0.512,
      "HBAR/USD": 0.081,
      "ETH/USD":  3241.0,
      "FLR/USD":  0.021,
    };
    const value = mocks[feed] ?? 0;
    return {
      feed,
      value,
      decimals: 4,
      timestamp: Math.floor(Date.now() / 1000),
      usd: `$${value.toFixed(4)}`,
      // note: mock data
    };
  }
}

/**
 * Get both XRP and HBAR prices for the pay-to-prove flow:
 * "How many XRP does the user need to pay to cover the HBAR reward?"
 */
export async function getRewardPricing() {
  const [xrp, hbar] = await Promise.all([
    getFTSOPrice("XRP/USD"),
    getFTSOPrice("HBAR/USD"),
  ]);
  const rewardHbar     = 0.005;                             // 0.005 HBAR reward
  const rewardUsd      = rewardHbar * hbar.value;
  const xrpEquivalent  = rewardUsd / xrp.value;

  return {
    xrp,
    hbar,
    rewardHbar,
    rewardUsd:      rewardUsd.toFixed(6),
    xrpEquivalent:  xrpEquivalent.toFixed(4),
  };
}
