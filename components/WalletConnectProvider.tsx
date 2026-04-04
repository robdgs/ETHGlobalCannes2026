"use client";
/**
 * components/WalletConnectProvider.tsx
 *
 * Wraps the app with Reown AppKit + Wagmi + React Query.
 * Must be a client component and placed in the root layout.
 *
 * AppKit gives us:
 *  - Universal wallet modal (MetaMask, Rainbow, Coinbase, Trust, etc.)
 *  - WalletConnect QR code for mobile wallets
 *  - Network switching UI
 *  - WalletConnect Pay session support
 */

import { createAppKit } from "@reown/appkit/react";
import { ReownAuthentication } from "@reown/appkit-siwx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, type Config } from "wagmi";
import {
  wagmiAdapter,
  wagmiConfig,
  projectId,
  networks,
} from "@/lib/walletconnect/config";

// Initialize AppKit only if projectId is configured
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: networks as any,
    defaultNetwork: networks[0],
    metadata: {
      name: "ProvenanceChain",
      description:
        "Prove a document existed. Publicly. Immutably.",
      url:
        typeof window !== "undefined"
          ? window.location.origin
          : "https://provenancechain.app",
      icons: ["https://avatars.githubusercontent.com/u/37784886"],
    },
    features: {
      analytics: true,
      email: false,
      socials: false,
      onramp: false,
    },
    themeMode: "dark",
    themeVariables: {
      "--w3m-accent": "#7B6EF6",
      "--w3m-border-radius-master": "2px",
    },
    siwx: new ReownAuthentication({
      required: false, // Set to false to allow wallet connection without signature
    }),
  });
}

const queryClient = new QueryClient();

export default function WalletConnectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WagmiProvider config={wagmiConfig as Config} initialState={undefined}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
