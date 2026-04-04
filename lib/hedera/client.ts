import 'server-only';
import { Client, AccountId, PrivateKey, Hbar } from "@hashgraph/sdk";

let _client: Client | null = null;
let _operatorKey: PrivateKey | null = null;

function parseKey(raw: string): PrivateKey {
  const r = raw.trim();
  // Try each format in order of likelihood
  const attempts: Array<[string, () => PrivateKey]> = [
    ["ED25519 DER",  () => PrivateKey.fromStringED25519(r)],
    ["ECDSA DER",    () => PrivateKey.fromStringECDSA(r)],
    ["ECDSA hex",    () => PrivateKey.fromStringECDSA(r.replace(/^0x/i,""))],
    ["ED25519 hex",  () => PrivateKey.fromStringED25519(r.replace(/^0x/i,""))],
    ["Generic",      () => PrivateKey.fromString(r)],
  ];
  for (const [, fn] of attempts) {
    try { return fn(); } catch {}
  }
  throw new Error(
    "Cannot parse HEDERA_OPERATOR_KEY — check the key in portal.hedera.com under 'Keys'"
  );
}

export function getClient(): Client {
  if (_client) return _client;

  const id  = (process.env.HEDERA_OPERATOR_ID  ?? "").trim();
  const key = (process.env.HEDERA_OPERATOR_KEY ?? "").trim();

  if (!id || !/^0\.0\.\d+$/.test(id)) {
    throw new Error(
      `HEDERA_OPERATOR_ID is missing or invalid ("${id}"). ` +
      `Expected format: 0.0.12345 — get one free at portal.hedera.com`
    );
  }
  if (!key || key.length < 10) {
    throw new Error(
      `HEDERA_OPERATOR_KEY is missing in .env.local. ` +
      `Copy your private key from portal.hedera.com → your account → Keys`
    );
  }

  const operatorId  = AccountId.fromString(id);
  const operatorKey = parseKey(key);
  _operatorKey = operatorKey;

  _client = process.env.HEDERA_NETWORK === "mainnet"
    ? Client.forMainnet()
    : Client.forTestnet();

  _client.setOperator(operatorId, operatorKey);
  _client.setDefaultMaxTransactionFee(new Hbar(10));
  _client.setMaxQueryPayment(new Hbar(2));

  return _client;
}

export function getOperatorKey(): PrivateKey {
  if (!_operatorKey) getClient();
  return _operatorKey!;
}
