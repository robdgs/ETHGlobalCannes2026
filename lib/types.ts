// lib/types.ts — shared types across client and server

export interface HFSResult {
  fileId: string;
  size: number;
  transactionId: string;
  certificateUrl: string;
  explorerUrl: string;
}

export interface SubmitResult {
  success: boolean;
  docHash: string;
  filename: string;
  hcs: {
    topicId: string;
    sequenceNumber: number;
    transactionId: string;
  };
  hts: {
    tokenId: string;
    serialNumber: number;
    transactionId: string;
  };
  /** null if HFS upload failed — core notarization is still valid */
  hfs: HFSResult | null;
  schedule: {
    scheduleId: string | null;
    transactionId: string;
    rewardTinybars: number;
  } | null;
  explorerLinks: Record<string, string>;
}

export interface HCSMessage {
  sequenceNumber: number;
  consensusTimestamp: string;
  runningHash: string;
  message: {
    v?: number;
    type?: string;
    docHash?: string;
    filename?: string;
    submitter?: string;
    submittedAt?: string;
    metadata?: Record<string, unknown>;
    raw?: string;
  };
}

export interface NFTRecord {
  serialNumber: number;
  accountId: string;
  createdTimestamp: string;
  metadata: {
    h?: string;
    seq?: number;
    f?: string;
  };
}

export interface AuditData {
  messages: HCSMessage[];
  nfts: NFTRecord[];
}

export interface StatusData {
  status: string;
  network: string;
  topicId: string | null;
  tokenId: string | null;
  tokenName?: string;
  totalMinted?: number;
}

export interface VerifyResult {
  verified: boolean;
  message?: string;
  proof?: HCSMessage;
  topicId?: string;
  mirrorUrl?: string;
}

// ── Unlink types ─────────────────────────────────────────────────────────────

export interface UnlinkPaymentResult {
  nullifier: string;
  relayTxHash: string;
  blockNumber: number;
  confirmedAt: string;
  chainId: number;
  amountWei: string;
  verified: boolean;
  explorerUrl: string;
}

export interface PrivateSubmitResult {
  payment: UnlinkPaymentResult;
  nullifier: string;
  hcs: {
    topicId: string;
    sequenceNumber: number;
    transactionId: string;
    stealthSubmitter: string;
  };
  hts: {
    tokenId: string;
    serialNumber: number;
    transactionId: string;
    stealthOwner: string;
  };
  tee: {
    attested: boolean;
    teeSignature: string;
    statement: string;
  };
  privacy: {
    paymentSenderVisible: false;
    hcsSubmitterVisible: false;
    nftOwnerLinkedToSender: false;
    documentHashVisible: true;
    zkMechanism: string;
    stealthAccountNote: string;
  };
  docHash: string;
  filename: string;
  timestamp: string;
}

// ── Flare types ───────────────────────────────────────────────────────────────

export interface TEEAttestation {
  attested: boolean;
  docHash: string;
  hcsTopicId: string;
  hcsSequenceNumber: number;
  consensusTimestamp: string | null;
  teeSignature: string;
  teePublicKey: string;
  attestedAt: string;
  verificationUrl: string;
  statement: string;
}

export interface FTSOPrice {
  feed: string;
  value: number;
  decimals: number;
  timestamp: number;
  usd: string;
}

export interface RewardPricing {
  xrp: FTSOPrice;
  hbar: FTSOPrice;
  rewardHbar: number;
  rewardUsd: string;
  xrpEquivalent: string;
}

export interface SmartAccountTriggerResult {
  triggered: boolean;
  xrplSender: string;
  docHash: string;
  filename: string;
  amountXRP: number;
  transactionHash?: string;
  explorerUrl?: string;
  calldata?: string;
  mode: "live" | "simulation";
}

export interface XRPLTriggerResponse {
  success: boolean;
  smartAccount: SmartAccountTriggerResult;
  pricing: RewardPricing;
  xrplInstructions: {
    destinationAddress: string;
    memoHex: string;
    memoDecoded: string;
    minimumXRP: string;
    note: string;
  };
}

export interface AccountResult {
  accountId: string;
  publicKey: string;
  privateKey: string;
  initialBalance: string;
  transactionId: string;
  explorerLink: string;
  warning: string;
}