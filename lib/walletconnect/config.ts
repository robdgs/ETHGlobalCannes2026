"use client";
/**
 * lib/walletconnect/config.ts
 *
 * Reown AppKit (WalletConnect v3) — ProvenanceChain configuration.
 *
 * Storage: in-memory only (no localStorage).
 * The wallet disconnects on every page refresh, forcing the user to
 * explicitly choose a wallet each time via the AppKit modal.
 * This prevents MetaMask (or any other injected wallet) from
 * auto-reconnecting and bypassing the wallet selection screen.
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

// ── Networks ──────────────────────────────────────────────────────────────────

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

// ── In-memory storage ─────────────────────────────────────────────────────────
// Using a no-op storage means wagmi never writes the connection to
// localStorage/sessionStorage. On refresh, isConnected is always false
// and the user must explicitly pick a wallet via the AppKit modal.
// This is intentional UX: ProvenanceChain wants explicit wallet selection
// for each payment session, preventing silent MetaMask auto-reconnect.

const noopStorage = {
  getItem:    (key: string) => null as any,
  setItem:    (key: string, value: string) => {},
  removeItem: (key: string) => {},
  key:        (index: number) => null as any,
  length:     0,
  clear:      () => {},
} as unknown as Storage;

// ── Wagmi adapter ─────────────────────────────────────────────────────────────

export const wagmiAdapter = new WagmiAdapter({
  storage: createStorage({ storage: noopStorage as any }) as any,
  ssr:     false,
  projectId,
  networks,
  transports: {
    [polygonAmoy.id]:      http(),
    [ethereumSepolia.id]:  http(),
  },
});

export const wagmiConfig = wagmiAdapter.wagmiConfig;