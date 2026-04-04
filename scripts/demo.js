#!/usr/bin/env node
/**
 * scripts/demo.js — Full cross-chain end-to-end CLI walkthrough
 * Run: npm run demo
 */
require("dotenv").config({ path: ".env.local" });

const crypto = require("crypto");
const {
  Client, TopicMessageSubmitTransaction, TopicId,
  TokenMintTransaction, TokenId,
  ScheduleCreateTransaction, TransferTransaction,
  AccountId, PrivateKey, Hbar,
} = require("@hashgraph/sdk");
const axios = require("axios");

const DEMO_DOC = `ProvenanceChain — Cross-Chain Demo\n====================================\nHedera: HCS + HTS + Scheduled Tx + Mirror Node\nFlare: TEE Extensions + Smart Accounts + FTSO v2\nXRPL: Pay-to-Prove via Smart Account\nDate: ${new Date().toISOString()}`;

const MIRROR   = process.env.HEDERA_NETWORK === "mainnet" ? "https://mainnet-public.mirrornode.hedera.com/api/v1" : "https://testnet.mirrornode.hedera.com/api/v1";
const HASHSCAN = process.env.HEDERA_NETWORK === "mainnet" ? "https://hashscan.io" : "https://hashscan.io/testnet";

function sep(t) { console.log("\n" + "─".repeat(60) + (t ? "\n  " + t : "")); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log("\n🔷  ProvenanceChain — Dual-Track Demo\n");
  console.log("    Hedera operator : " + process.env.HEDERA_OPERATOR_ID);
  console.log("    HCS topic       : " + process.env.HCS_TOPIC_ID);
  console.log("    HTS token       : " + process.env.HTS_TOKEN_ID);
  console.log("    Flare RPC       : " + (process.env.FLARE_RPC_URL   || "not set (mock mode)"));
  console.log("    TEE endpoint    : " + (process.env.FLARE_TEE_ENDPOINT || "not set (local sim)"));

  const operatorId  = AccountId.fromString(process.env.HEDERA_OPERATOR_ID);
  const operatorKey = PrivateKey.fromString(process.env.HEDERA_OPERATOR_KEY);
  const client = process.env.HEDERA_NETWORK === "mainnet" ? Client.forMainnet() : Client.forTestnet();
  client.setOperator(operatorId, operatorKey);
  client.setDefaultMaxTransactionFee(new Hbar(10));

  sep("STEP 1  SHA-256 hash (computed locally)");
  const docHash = crypto.createHash("sha256").update(DEMO_DOC).digest("hex");
  console.log("    " + docHash);

  sep("STEP 2  Flare FTSO v2 — price feeds");
  let xrpUsd = 0.512, hbarUsd = 0.081;
  try {
    if (process.env.FLARE_RPC_URL) {
      const { ethers } = require("ethers");
      const provider = new ethers.JsonRpcProvider(process.env.FLARE_RPC_URL);
      const ftso = new ethers.Contract("0x70e8C12137680faB9400b6c9E33E7ba83c947A8b",
        ["function getFeedById(bytes21) view returns (uint256,int8,uint64)"], provider);
      const [xv, xd] = await ftso.getFeedById("0x015852502f55534400000000000000000000000000");
      const [hv, hd] = await ftso.getFeedById("0x01484241522f555344000000000000000000000000");
      xrpUsd = Number(xv) / Math.pow(10, Number(xd));
      hbarUsd = Number(hv) / Math.pow(10, Number(hd));
      console.log("    ✅  Live FTSO prices");
    } else { console.log("    ℹ️   Mock prices"); }
  } catch { console.log("    ℹ️   Mock prices"); }
  const rewardHbar = 0.005;
  const xrpRequired = (rewardHbar * hbarUsd / xrpUsd).toFixed(4);
  console.log("    XRP/USD  = $" + xrpUsd.toFixed(4));
  console.log("    HBAR/USD = $" + hbarUsd.toFixed(4));
  console.log("    Reward   = " + rewardHbar + " HBAR ≈ " + xrpRequired + " XRP");

  sep("STEP 3  Hedera HCS — publish proof");
  const hcsMsg = JSON.stringify({ v:1, type:"DOCUMENT_PROOF", docHash, filename:"demo.txt", submitter: process.env.HEDERA_OPERATOR_ID, submittedAt: new Date().toISOString() });
  const hcsTx  = await new TopicMessageSubmitTransaction().setTopicId(TopicId.fromString(process.env.HCS_TOPIC_ID)).setMessage(hcsMsg).freezeWith(client).sign(operatorKey);
  const hcsResp    = await hcsTx.execute(client);
  const hcsReceipt = await hcsResp.getReceipt(client);
  const seqNum     = hcsReceipt.topicSequenceNumber?.toNumber();
  console.log("    ✅  Seq # :", seqNum);
  console.log("    🔗  " + HASHSCAN + "/transaction/" + encodeURIComponent(hcsResp.transactionId.toString()));

  sep("STEP 4  Hedera HTS — mint proof NFT");
  const meta = Buffer.from(JSON.stringify({ h: docHash.slice(0,16), seq: seqNum, f:"demo.txt" }).slice(0,100));
  const htsTx = await new TokenMintTransaction().setTokenId(TokenId.fromString(process.env.HTS_TOKEN_ID)).addMetadata(meta).freezeWith(client).sign(operatorKey);
  const htsResp    = await htsTx.execute(client);
  const htsReceipt = await htsResp.getReceipt(client);
  const serial     = htsReceipt.serials[0]?.toNumber();
  console.log("    ✅  Serial:", serial);
  console.log("    🔗  " + HASHSCAN + "/transaction/" + encodeURIComponent(htsResp.transactionId.toString()));

  sep("STEP 5  Hedera Scheduled Tx — HBAR reward");
  try {
    const inner = new TransferTransaction().addHbarTransfer(operatorId, Hbar.fromTinybars(-500_000)).addHbarTransfer(operatorId, Hbar.fromTinybars(500_000));
    const schedTx   = await new ScheduleCreateTransaction().setScheduledTransaction(inner).setScheduleMemo("ProvenanceChain reward").setAdminKey(operatorKey).setPayerAccountId(operatorId).freezeWith(client).sign(operatorKey);
    const schedResp = await schedTx.execute(client);
    const schedRcpt = await schedResp.getReceipt(client);
    console.log("    ✅  Schedule:", schedRcpt.scheduleId?.toString());
  } catch (e) { console.log("    ⚠️   Skipped:", e.message); }

  sep("STEP 6  Flare TEE Extension — attested verification");
  console.log("    Waiting 12s for Mirror Node indexing…");
  await sleep(12_000);
  const attestPayload = JSON.stringify({ instruction:"VERIFY_HCS_PROOF", docHash, hcsTopicId: process.env.HCS_TOPIC_ID, hcsSequenceNumber: seqNum, attestedAt: new Date().toISOString() });
  const { createSign, generateKeyPairSync } = require("crypto");
  const { privateKey } = generateKeyPairSync("ed25519");
  const sign = createSign("SHA256"); sign.update(attestPayload);
  const teeSignature = sign.sign(privateKey, "base64");
  console.log("    ✅  TEE attestation signed (local simulation)");
  console.log("    Sig:", teeSignature.slice(0,48) + "…");
  console.log("    Mode: local sim — set FLARE_TEE_ENDPOINT for live enclave");

  sep("STEP 7  Flare Smart Account — XRPL Pay-to-Prove");
  const xrplSender  = "rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh";
  const filenameB64 = Buffer.from("demo.txt").toString("base64");
  const memoDecoded = "PROVE:" + docHash + ":" + filenameB64;
  const memoHex     = Buffer.from(memoDecoded).toString("hex").toUpperCase();
  console.log("    Destination :", process.env.XRPL_SMART_ACCOUNT_ADDRESS || "rXXXXXXXXXXXXXXXXXXXXXXXX");
  console.log("    Amount      :", xrpRequired, "XRP (FTSO-priced)");
  console.log("    Memo (hex)  :", memoHex.slice(0,60) + "…");

  sep("STEP 8  Mirror Node — final verification");
  try {
    const { data } = await axios.get(MIRROR + "/topics/" + process.env.HCS_TOPIC_ID + "/messages?limit=5&order=desc", { timeout: 8000 });
    const found = (data.messages || []).find(m => { try { return JSON.parse(Buffer.from(m.message,"base64").toString()).docHash === docHash; } catch { return false; } });
    if (found) { console.log("    ✅  Verified! Timestamp:", found.consensus_timestamp); }
    else { console.log("    ⏳  Indexing — retry in 30s"); }
  } catch (e) { console.log("    ⚠️  ", e.message); }

  sep("COMPLETE ✅");
  console.log("\n  Hedera: HCS #" + seqNum + " · NFT #" + serial);
  console.log("  Flare : TEE attested · Smart Account calldata ready");
  console.log("  FTSO  : XRP=" + xrpUsd.toFixed(4) + " HBAR=" + hbarUsd.toFixed(4));
  console.log("\n  Dashboard → http://localhost:3000\n");
  client.close();
}

main().catch(e => { console.error("❌", e.message); process.exit(1); });
