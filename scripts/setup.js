#!/usr/bin/env node
const fs   = require("fs");
const path = require("path");

// ── Load .env.local / .env without dotenv ────────────────────────────────────
function loadEnv() {
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
    console.log("   Loaded env from: " + p);
    return p;
  }
}

const envPath = loadEnv();

const id  = process.env.HEDERA_OPERATOR_ID;
const key = process.env.HEDERA_OPERATOR_KEY;

if (!id || !id.match(/^0\.0\.\d+$/)) {
  console.error("\n❌  HEDERA_OPERATOR_ID is missing or invalid (expected 0.0.12345)\n");
  process.exit(1);
}
if (!key || key.length < 10) {
  console.error("\n❌  HEDERA_OPERATOR_KEY is missing in .env.local\n");
  process.exit(1);
}

let SDK;
try { SDK = require("@hashgraph/sdk"); }
catch { console.error("\n❌  Run: npm install\n"); process.exit(1); }

const { Client, TopicCreateTransaction, TokenCreateTransaction,
        TokenType, TokenSupplyType, PrivateKey, AccountId, Hbar } = SDK;

// ── Smart key parser: tries all formats ─────────────────────────────────────
function parseKey(raw) {
  // 1. DER-prefixed ED25519  (starts with 302e)
  if (raw.toLowerCase().startsWith("302e")) {
    try { return PrivateKey.fromStringED25519(raw); } catch {}
  }
  // 2. DER-prefixed ECDSA   (starts with 3030 or 3026 or 30540201)
  if (raw.toLowerCase().startsWith("30")) {
    try { return PrivateKey.fromStringECDSA(raw); } catch {}
  }
  // 3. Raw hex 64 chars — try ECDSA first (Hedera portal default since 2023)
  if (/^[0-9a-f]{64}$/i.test(raw)) {
    try { return PrivateKey.fromStringECDSA(raw); } catch {}
    try { return PrivateKey.fromStringED25519(raw); } catch {}
  }
  // 4. 0x-prefixed hex
  if (raw.startsWith("0x") || raw.startsWith("0X")) {
    try { return PrivateKey.fromStringECDSA(raw.slice(2)); } catch {}
  }
  // 5. Last resort: generic fromString
  return PrivateKey.fromString(raw);
}

function setVar(content, key, value) {
  const re = new RegExp(`^${key}=.*$`, "m");
  return re.test(content) ? content.replace(re, `${key}=${value}`) : content + `\n${key}=${value}`;
}

async function main() {
  console.log("\n🔷  ProvenanceChain — Hedera Setup\n");
  console.log("    Operator : " + id);
  console.log("    Network  : " + (process.env.HEDERA_NETWORK || "testnet") + "\n");

  const operatorId  = AccountId.fromString(id);
  const operatorKey = parseKey(key);

  console.log("    Key type : " + operatorKey.type);

  const client = process.env.HEDERA_NETWORK === "mainnet"
    ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  client.setDefaultMaxTransactionFee(new Hbar(10));

  // 1. HCS Topic
  console.log("\n📡  Creating HCS topic...");
  const topicTx      = await new TopicCreateTransaction()
    .setTopicMemo("ProvenanceChain — document proof log")
    .setSubmitKey(operatorKey.publicKey)
    .execute(client);
  const topicReceipt = await topicTx.getReceipt(client);
  const topicId      = topicReceipt.topicId.toString();
  console.log("    ✅  HCS topic: " + topicId);

  // 2. HTS NFT Token
  console.log("🪙   Creating HTS NFT collection...");
  const tokenTx      = await new TokenCreateTransaction()
    .setTokenName("ProvenanceChain Proof")
    .setTokenSymbol("PCP")
    .setTokenType(TokenType.NonFungibleUnique)
    .setSupplyType(TokenSupplyType.Finite)
    .setMaxSupply(1_000_000)
    .setInitialSupply(0)
    .setDecimals(0)
    .setTreasuryAccountId(operatorId)
    .setAdminKey(operatorKey)
    .setSupplyKey(operatorKey)
    .setTokenMemo("Proof-of-contribution NFT — ProvenanceChain")
    .setMaxTransactionFee(new Hbar(30))
    .execute(client);
  const tokenReceipt = await tokenTx.getReceipt(client);
  const tokenId      = tokenReceipt.tokenId.toString();
  console.log("    ✅  HTS token: " + tokenId);

  // Write back to env file
  let content = fs.readFileSync(envPath, "utf8");
  content = setVar(content, "HCS_TOPIC_ID", topicId);
  content = setVar(content, "HTS_TOKEN_ID", tokenId);
  fs.writeFileSync(envPath, content);

  console.log("\n✅  Done! Written to: " + path.basename(envPath));
  console.log("    HCS_TOPIC_ID = " + topicId);
  console.log("    HTS_TOKEN_ID = " + tokenId);
  console.log("\n    Next: npm run dev\n");

  client.close();
}

main().catch(err => {
  console.error("\n❌  Setup failed: " + (err.message || err));

  // Give a specific hint for signature errors
  if (err.message && err.message.includes("INVALID_SIGNATURE")) {
    console.error("\n💡  This usually means the private key doesn't match the account.");
    console.error("    Check your key in the Hedera portal:");
    console.error("    https://portal.hedera.com → your account → 'Keys'");
    console.error("    Make sure you're copying the PRIVATE key, not the public key.\n");
  }

  process.exit(1);
});
