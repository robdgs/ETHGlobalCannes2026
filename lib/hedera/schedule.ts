import 'server-only';
/**
 * lib/hedera/schedule.ts — Hedera Scheduled Transactions
 */
import {
  ScheduleCreateTransaction,
  TransferTransaction,
  AccountId,
  Hbar,
} from "@hashgraph/sdk";
import { getClient, getOperatorKey } from "./client";

export async function scheduleReward(
  toAccountId: string,
  tinybars = 1_000_000,
  memo = ""
) {
  const client = getClient();
  const from   = AccountId.fromString(process.env.HEDERA_OPERATOR_ID!);
  const to     = AccountId.fromString(toAccountId);

  const innerTx = new TransferTransaction()
    .addHbarTransfer(from, Hbar.fromTinybars(-tinybars))
    .addHbarTransfer(to,   Hbar.fromTinybars( tinybars));

  const tx = await new ScheduleCreateTransaction()
    .setScheduledTransaction(innerTx)
    .setScheduleMemo(memo || `ProvenanceChain reward — ${new Date().toISOString()}`)
    .setAdminKey(getOperatorKey())
    .setPayerAccountId(from)
    .freezeWith(client)
    .sign(getOperatorKey());

  const response = await tx.execute(client);
  const receipt  = await response.getReceipt(client);

  return {
    scheduleId:    receipt.scheduleId?.toString() ?? null,
    transactionId: response.transactionId.toString(),
  };
}
