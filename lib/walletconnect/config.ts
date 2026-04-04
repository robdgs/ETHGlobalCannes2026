"use client";
/**
 * lib/walletconnect/config.ts
 *
 * Reown AppKit (WalletConnect v3) — ProvenanceChain configuration.
 *
 * Two networks:
 *   - Polygon Amoy testnet  → public WalletConnect payments
 *   - Polygon Amoy testnet  → Unlink ZK private payments (same network, different flow)
 *
 * Get a free Project ID at https://cloud.reown.com
 * Get a WCPay ID at https://dashboard.walletconnect.com
 */

import { createStorage, http } from "wagmi";
import { defineChain } from "viem";
import { WagmiAdapter } from "@reown/appkit-adapter-wagmi";

export const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ?? "";

if (!projectId && typeof window !== "undefined") {
  console.warn(
    "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID not set — get one free at https://cloud.reown.com",
  );
}

// ── Networks ─────────────────────────────────────────────────────────────────

export const polygonAmoy = defineChain({
  id: 80002,
  name: "Polygon Amoy",
  nativeCurrency: { name: "MATIC", symbol: "MATIC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc-amoy.polygon.technology"] },
  },
  blockExplorers: {
    default: { name: "PolygonScan", url: "https://amoy.polygonscan.com" },
  },
  testnet: true,
});

export const ethereumSepolia = defineChain({
  id: 11155111,
  name: "Ethereum Sepolia",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.sepolia.org"] },
  },
  blockExplorers: {
    default: { name: "Etherscan", url: "https://sepolia.etherscan.io" },
  },
  testnet: true,
});

export const networks = [polygonAmoy, ethereumSepolia];

// ── Wagmi adapter ─────────────────────────────────────────────────────────────
// Initialize storage - localStorage on client only
const storage =
  typeof window !== "undefined"
    ? createStorage({ storage: localStorage })
    : undefined;

export const wagmiAdapter = new WagmiAdapter({
  ...(storage && { storage }),
  ssr: false,
  projectId,
  networks,
  transports: {
    [polygonAmoy.id]: http(),
    [ethereumSepolia.id]: http(),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;
