import 'server-only';
import { TokenMintTransaction, TransferTransaction, TokenId, AccountId } from "@hashgraph/sdk";
import { getClient, getOperatorKey } from "./client";

interface MintParams { docHash: string; topicSequenceNumber: number; filename: string; }

export async function mintProofToken({ docHash, topicSequenceNumber, filename }: MintParams) {
  const raw = process.env.HTS_TOKEN_ID ?? "";
  if (!raw || !/^0\.0\.\d+$/.test(raw.trim())) {
    throw new Error(`HTS_TOKEN_ID is not set or invalid ("${raw}"). Run: npm run setup`);
  }

  const client  = getClient();
  const tokenId = TokenId.fromString(raw.trim());

  const meta = Buffer.from(
    JSON.stringify({ h: docHash.slice(0,16), seq: topicSequenceNumber, f: filename.slice(0,32) }).slice(0,100)
  );

  const tx = await new TokenMintTransaction()
    .setTokenId(tokenId)
    .addMetadata(meta)
    .freezeWith(client)
    .sign(getOperatorKey());

  const response = await tx.execute(client);
  const receipt  = await response.getReceipt(client);

  return {
    serialNumber:  receipt.serials[0]?.toNumber() ?? 0,
    transactionId: response.transactionId.toString(),
  };
}

export async function transferToken(serialNumber: number, toAccountId: string) {
  const raw = process.env.HTS_TOKEN_ID ?? "";
  if (!raw || !/^0\.0\.\d+$/.test(raw.trim())) {
    throw new Error(`HTS_TOKEN_ID is not set or invalid. Run: npm run setup`);
  }

  const client  = getClient();
  const tokenId = TokenId.fromString(raw.trim());
  const from    = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!.trim());
  const to      = AccountId.fromString(toAccountId.trim());

  const tx = await new TransferTransaction()
    .addNftTransfer(tokenId, serialNumber, from, to)
    .freezeWith(client)
    .sign(getOperatorKey());

  const response = await tx.execute(client);
  await response.getReceipt(client);
  return { transactionId: response.transactionId.toString() };
}
