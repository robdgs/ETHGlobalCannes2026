#!/usr/bin/env node
/**
 * scripts/diagnose.js
 * Run: node scripts/diagnose.js
 *
 * Compares the public key derived from your private key
 * against the public key actually registered on your Hedera account.
 * If they don't match, your .env.local has the wrong key.
 */
const fs   = require("fs");
const path = require("path");
const https = require("https");

// Load env
for (const name of [".env.local", ".env"]) {
  const p = path.join(__dirname, "..", name);
  if (!fs.existsSync(p)) continue;
  for (const line of fs.readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (k && v && !process.env[k]) process.env[k] = v;
  }
  break;
}

const accountId = process.env.HEDERA_OPERATOR_ID;
const rawKey    = process.env.HEDERA_OPERATOR_KEY;

console.log("\n🔍  ProvenanceChain — Key Diagnostics\n");
console.log("    Account  : " + accountId);
console.log("    Key      : " + rawKey.slice(0, 12) + "…" + rawKey.slice(-8));

let SDK;
try { SDK = require("@hashgraph/sdk"); }
catch { console.error("\n❌  Run: npm install\n"); process.exit(1); }

const { PrivateKey } = SDK;

function tryParseKey(raw) {
  const attempts = [
    ["ED25519 DER",  () => PrivateKey.fromStringED25519(raw)],
    ["ECDSA DER",    () => PrivateKey.fromStringECDSA(raw)],
    ["ECDSA hex",    () => PrivateKey.fromStringECDSA(raw.replace(/^0x/i, ""))],
    ["ED25519 hex",  () => PrivateKey.fromStringED25519(raw.replace(/^0x/i, ""))],
    ["Generic",      () => PrivateKey.fromString(raw)],
  ];
  for (const [label, fn] of attempts) {
    try {
      const k = fn();
      return { key: k, label };
    } catch {}
  }
  return null;
}

// Step 1: derive public key from the private key we have
const parsed = tryParseKey(rawKey);
if (!parsed) {
  console.error("\n❌  Could not parse private key in any known format.");
  console.error("    Go to portal.hedera.com → your account → Keys → copy the private key.\n");
  process.exit(1);
}

const derivedPublicKey = parsed.key.publicKey.toString().toLowerCase();
console.log("\n    Key format  : " + parsed.label);
console.log("    Derived pub : " + derivedPublicKey.slice(0, 24) + "…");

// Step 2: fetch the actual public key from Mirror Node
const mirrorUrl = `https://testnet.mirrornode.hedera.com/api/v1/accounts/${accountId}`;
console.log("\n    Querying Mirror Node for account " + accountId + "…");

https.get(mirrorUrl, { headers: { "User-Agent": "ProvenanceChain-diagnose" } }, (res) => {
  let data = "";
  res.on("data", chunk => data += chunk);
  res.on("end", () => {
    if (res.statusCode === 404) {
      console.error("\n❌  Account " + accountId + " not found on testnet.");
      console.error("    Make sure HEDERA_NETWORK=testnet and the account exists.\n");
      process.exit(1);
    }

    let account;
    try { account = JSON.parse(data); }
    catch { console.error("\n❌  Could not parse Mirror Node response.\n"); process.exit(1); }

    // Mirror Node returns key in different structures depending on key type
    const keyObj = account.key;
    if (!keyObj) {
      console.error("\n❌  No key found on account. The account may not be initialised.\n");
      process.exit(1);
    }

    // key._type: "ED25519" | "ECDSA_SECP256K1" | "ProtobufEncoded"
    const onChainKey  = (keyObj.key ?? "").toLowerCase();
    const onChainType = keyObj._type ?? "unknown";

    console.log("    On-chain type: " + onChainType);
    console.log("    On-chain pub : " + onChainKey.slice(0, 24) + "…");

    console.log("\n" + "─".repeat(60));

    if (!onChainKey) {
      console.log("⚠  Could not read on-chain key. Try logging in to portal.hedera.com.");
      process.exit(0);
    }

    // Compare: ED25519 public keys are 32 bytes (64 hex). ECDSA are 33 bytes (66 hex).
    // The derived key may have a DER prefix; strip to raw for comparison.
    const stripDer = (hex) => {
      // ED25519 DER prefix is 302a300506032b6570032100 (24 hex chars prefix)
      if (hex.startsWith("302a")) return hex.slice(24);
      // ECDSA compressed DER prefix varies; just take last 66 chars for ECDSA
      if (hex.length > 66) return hex.slice(-66);
      return hex;
    };

    const derivedRaw  = stripDer(derivedPublicKey);
    const onChainRaw  = stripDer(onChainKey);
    const match       = derivedRaw === onChainRaw || derivedPublicKey.includes(onChainRaw) || onChainKey.includes(derivedRaw);

    if (match) {
      console.log("✅  KEYS MATCH — your private key is correct for this account.");
      console.log("    The INVALID_SIGNATURE error may be a network issue. Try again.\n");
    } else {
      console.log("❌  KEYS DO NOT MATCH\n");
      console.log("    Your .env.local private key derives to:");
      console.log("      " + derivedRaw);
      console.log("\n    But account " + accountId + " has public key:");
      console.log("      " + onChainRaw);
      console.log("\n💡  How to fix:");
      console.log("    1. Go to https://portal.hedera.com");
      console.log("    2. Log in and select your account (" + accountId + ")");
      console.log("    3. Click 'Keys' or the key icon");
      console.log("    4. Copy the PRIVATE key (not the public key)");
      console.log("    5. Paste it into .env.local as HEDERA_OPERATOR_KEY=...");
      console.log("    6. Run: npm run setup\n");
      console.log("    Alternatively, create a brand-new account at portal.hedera.com");
      console.log("    and use those fresh credentials.\n");
    }
  });
}).on("error", (e) => {
  console.error("\n❌  Mirror Node unreachable: " + e.message + "\n");
});
