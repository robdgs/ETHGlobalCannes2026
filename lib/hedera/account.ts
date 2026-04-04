import 'server-only';
/**
 * lib/hedera/account.ts — Hedera Account Service
 */
import {
  AccountCreateTransaction,
  TokenAssociateTransaction,
  PrivateKey,
  AccountId,
  TokenId,
  Hbar,
} from "@hashgraph/sdk";
import { getClient, getOperatorKey } from "./client";

export async function createAccount(initialHbar = 5) {
  const client = getClient();
  const newKey = PrivateKey.generateED25519();

  const tx = await new AccountCreateTransaction()
    .setKey(newKey.publicKey)
    .setInitialBalance(new Hbar(Math.min(initialHbar, 10)))
    .setAccountMemo("ProvenanceChain user account")
    .setMaxAutomaticTokenAssociations(10)
    .execute(client);

  const receipt   = await tx.getReceipt(client);
  const accountId = receipt.accountId!.toString();

  return {
    accountId,
    publicKey:     newKey.publicKey.toString(),
    privateKey:    newKey.toString(), // ⚠️ demo only
    initialBalance: `${initialHbar} HBAR`,
    transactionId: tx.transactionId.toString(),
  };
}

export async function associateWithToken(accountId: string, privateKeyStr: string) {
  const client  = getClient();
  const tokenId = TokenId.fromString(process.env.HTS_TOKEN_ID!);
  const accKey  = PrivateKey.fromString(privateKeyStr);

  const tx = await new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(accountId))
    .setTokenIds([tokenId])
    .freezeWith(client)
    .sign(accKey);

  const signed   = await tx.sign(getOperatorKey());
  const response = await signed.execute(client);
  await response.getReceipt(client);

  return { transactionId: response.transactionId.toString() };
}
