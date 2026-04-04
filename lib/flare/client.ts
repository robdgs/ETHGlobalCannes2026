import 'server-only';
/**
 * lib/flare/client.ts
 *
 * Ethers.js v6 provider + signer for the Flare Coston2 testnet (or mainnet).
 *
 * Flare network IDs:
 *   Flare Mainnet  — chainId 14,  RPC https://flare-api.flare.network/ext/C/rpc
 *   Coston2 Testnet— chainId 114, RPC https://coston2-api.flare.network/ext/C/rpc
 *
 * Server-only — never imported by client components.
 */

import { JsonRpcProvider, Wallet, type Provider } from "ethers";

let _provider: JsonRpcProvider | null = null;
let _signer:   Wallet | null = null;

export function getFlareProvider(): JsonRpcProvider {
  if (_provider) return _provider;
  const rpc = process.env.FLARE_RPC_URL;
  if (!rpc) throw new Error("FLARE_RPC_URL is not set in .env.local");
  _provider = new JsonRpcProvider(rpc);
  return _provider;
}

export function getFlareSigner(): Wallet {
  if (_signer) return _signer;
  const pk = process.env.FLARE_OPERATOR_PRIVATE_KEY;
  if (!pk) throw new Error("FLARE_OPERATOR_PRIVATE_KEY is not set in .env.local");
  _signer = new Wallet(pk, getFlareProvider());
  return _signer;
}

/** Coston2 testnet block explorer base */
export function getFlareExplorerBase(): string {
  const rpc = process.env.FLARE_RPC_URL ?? "";
  return rpc.includes("coston2")
    ? "https://coston2.testnet.flarescan.com"
    : "https://flarescan.com";
}
