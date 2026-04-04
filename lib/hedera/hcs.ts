import 'server-only';
import { TopicMessageSubmitTransaction, TopicId } from "@hashgraph/sdk";
import { getClient, getOperatorKey } from "./client";

interface ProofPayload {
  docHash: string;
  filename: string;
  submitter?: string;
  metadata?: Record<string, unknown>;
}

export async function publishProof(payload: ProofPayload) {
  const raw = process.env.HCS_TOPIC_ID ?? "";
  if (!raw || !/^0\.0\.\d+$/.test(raw.trim())) {
    throw new Error(`HCS_TOPIC_ID is not set or invalid ("${raw}"). Run: npm run setup`);
  }

  const client  = getClient();
  const topicId = TopicId.fromString(raw.trim());

  const message = JSON.stringify({
    v: 1, type: "DOCUMENT_PROOF",
    docHash:     payload.docHash,
    filename:    payload.filename,
    submitter:   payload.submitter || process.env.HEDERA_OPERATOR_ID,
    submittedAt: new Date().toISOString(),
    metadata:    payload.metadata ?? {},
  });

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .freezeWith(client)
    .sign(getOperatorKey());

  const response = await tx.execute(client);
  const receipt  = await response.getReceipt(client);

  return {
    topicSequenceNumber: receipt.topicSequenceNumber?.toNumber() ?? 0,
    transactionId: response.transactionId.toString(),
  };
}

/**
 * Publish a CERTIFICATE_LINK message on the same HCS topic.
 * Links a docHash to its HFS certificate file ID.
 * Published after HFS upload so the dashboard can resolve the download URL.
 *
 * Message shape:
 *   { v:1, type:"CERTIFICATE_LINK", docHash, hfsFileId, hcsSeq }
 */
export async function publishCertificateLink(params: {
  docHash:   string;
  hfsFileId: string;
  hcsSeq:    number;
}) {
  const raw = process.env.HCS_TOPIC_ID ?? "";
  if (!raw || !/^0\.0\.\d+$/.test(raw.trim())) {
    throw new Error(`HCS_TOPIC_ID is not set or invalid. Run: npm run setup`);
  }

  const client  = getClient();
  const topicId = TopicId.fromString(raw.trim());

  const message = JSON.stringify({
    v:         1,
    type:      "CERTIFICATE_LINK",
    docHash:   params.docHash,
    hfsFileId: params.hfsFileId,
    hcsSeq:    params.hcsSeq,
    linkedAt:  new Date().toISOString(),
  });

  const tx = await new TopicMessageSubmitTransaction()
    .setTopicId(topicId)
    .setMessage(message)
    .freezeWith(client)
    .sign(getOperatorKey());

  const response = await tx.execute(client);
  const receipt  = await response.getReceipt(client);

  return {
    topicSequenceNumber: receipt.topicSequenceNumber?.toNumber() ?? 0,
    transactionId: response.transactionId.toString(),
  };
}