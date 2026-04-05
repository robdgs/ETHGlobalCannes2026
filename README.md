# ProvenanceChain

**On-chain notary. No lawyer. No office. Just the ledger.**

ProvenanceChain lets anyone certify that a document existed at a specific point in time. Upload a file or paste text — the SHA-256 fingerprint is computed locally, stamped on Hedera's public ledger, and a verifiable certificate is stored permanently on-chain. Your file never leaves your device.

---

## How it works

```
1. Verify    →  World ID proof of humanity. One person, one notary.
2. Select    →  SHA-256 fingerprint computed in the browser. Document never transmitted.
3. Pay       →  WalletConnect. Any EVM wallet, any device.
4. Stamp     →  Fingerprint published to Hedera Consensus Service.
5. Certify   →  NFT minted on Hedera Token Service.
               HTML certificate stored immutably on Hedera File Service.
6. Verify    →  Anyone can verify any hash against the public ledger, forever.
```

---

## World ID — Proof of Human

A notary is, by definition, a human being. Before certifying that a document existed, you prove that *you* do.

ProvenanceChain uses **World ID 4.0** (IDKit) as a real access constraint — not cosmetic. The gate runs in Next.js middleware and checks for a verified session cookie on every request. Unverified users cannot reach the app.

### Flow

```
User visits ProvenanceChain
    ↓
middleware.ts checks world_verified cookie
    ├─ present  →  access granted
    └─ absent   →  redirect to /gate
                        ↓
                 POST /api/world/signature  →  signRequest() backend only
                        ↓
                 IDKit.request() + orbLegacy() preset
                        ↓
                 connectorURI rendered as QR code
                        ↓
                 User scans with World App → ZK proof generated on device
                        ↓
                 pollUntilCompletion()
                        ↓
                 POST /api/world/verify  →  forwarded as-is to
                 https://developer.world.org/api/v4/verify/{rp_id}
                        ↓
                 httpOnly cookie set (7 days) → access granted
```

### Privacy guarantees

- Zero personal data transmitted — the backend receives a ZK proof, not biometrics or identity
- Nullifier hash is unique per `(person × app × action)` — World ID enforces one verification per human
- The signing key (`RP_SIGNING_KEY`) never leaves the server
- `app_id` is the only World ID value exposed client-side — it appears in every IDKit request by design

### Files

| File | Purpose |
|------|---------|
| `middleware.ts` | Route guard — checks cookie, redirects to `/gate` |
| `app/gate/page.tsx` | Gate UI — QR code, polling, status |
| `app/api/world/signature/route.ts` | Generates RP signature server-side |
| `app/api/world/verify/route.ts` | Verifies proof, sets cookie |
| `app/api/world/logout/route.ts` | Clears cookie (testing) |

### Environment variables

```bash
NEXT_PUBLIC_WORLD_APP_ID=app_...    # public — used in middleware (Edge Runtime)
WORLD_APP_ID=app_...               # server — used in API routes
WORLD_RP_ID=rp_...                 # server only
RP_SIGNING_KEY=...                 # server only, never expose

NEXT_PUBLIC_WORLD_ACTION=notarize-document
NEXT_PUBLIC_WORLD_ENV=staging      # use "production" for live
```

Get credentials at **https://developer.worldcoin.org** → New App → Enable World ID 4.0.

Test without a physical World device: set `NEXT_PUBLIC_WORLD_ENV=staging` and use **https://simulator.worldcoin.org**.

---

## Hedera — the trust layer

ProvenanceChain uses four native Hedera services. No smart contracts required.

### Hedera Consensus Service (HCS)

Every notarization is published as a message to a dedicated HCS topic. The network orders it, timestamps it with asynchronous Byzantine fault-tolerant consensus, and makes it permanently queryable via the Mirror Node REST API.

Two message types are published per notarization:

```json
// DOCUMENT_PROOF — the notarization itself
{
  "v": 1,
  "type": "DOCUMENT_PROOF",
  "docHash": "sha256hex...",
  "filename": "contract.pdf",
  "submitter": "0.0.12345",
  "submittedAt": "2025-04-05T14:32:00Z"
}

// CERTIFICATE_LINK — links the hash to its HFS certificate
{
  "v": 1,
  "type": "CERTIFICATE_LINK",
  "docHash": "sha256hex...",
  "hfsFileId": "0.0.98765",
  "hcsSeq": 42
}
```

The `CERTIFICATE_LINK` message makes certificates retroactively discoverable — the dashboard reads it from Mirror Node and resolves the download URL for any past notarization.

### Hedera Token Service (HTS)

Each notarization mints a unique NFT from the `PCP` (ProvenanceChain Proof) collection. The NFT metadata references the document hash and HCS sequence number. Certificates can be transferred to any Hedera account.

### Hedera File Service (HFS)

After every notarization, a self-contained HTML certificate is uploaded to HFS. The file is immutable — no admin key means it cannot be deleted or modified. Served directly from:

```
GET /api/certificate?fileId=0.0.XXXXX
```

The certificate is print-ready, contains all verification data, and links directly to HashScan.

### Hedera Scheduled Transactions

A scheduled HBAR transfer is created as a reward for each notarization. The schedule can be countersigned to release the reward.

### Pipeline

```
Submit document
    │
    ├─ HCS  → publishProof()              # DOCUMENT_PROOF message
    ├─ HTS  → mintProofToken()            # NFT serial #N
    ├─ Sched → scheduleReward()           # deferred HBAR reward
    └─ HFS  → uploadToHFS()              # HTML certificate
                └─ HCS → publishCertificateLink()  # CERTIFICATE_LINK
```

### Verification

Any notarization can be independently verified without ProvenanceChain:

```bash
# Direct Mirror Node query
curl "https://testnet.mirrornode.hedera.com/api/v1/topics/{TOPIC_ID}/messages?limit=100" \
  | jq '.messages[] | select(.message | @base64d | fromjson | .docHash == "YOUR_HASH")'
```

The proof is valid as long as the Hedera network exists. No dependency on ProvenanceChain servers.

### Environment variables

```bash
HEDERA_OPERATOR_ID=0.0.12345
HEDERA_OPERATOR_KEY=302e...
HEDERA_NETWORK=testnet
HCS_TOPIC_ID=0.0.xxxxx       # created by npm run setup
HTS_TOKEN_ID=0.0.xxxxx       # created by npm run setup
```

---

## WalletConnect — payment and identity

Payment is handled by **Reown AppKit (WalletConnect v3)**. Any EVM wallet is supported — MetaMask, Rainbow, Coinbase Wallet, or a mobile wallet via QR code.

The payment (0.001 MATIC on Polygon Amoy testnet) is sent with a memo field encoding the document hash:

```
PROVE:<sha256_hex>:<filename_base64>
```

The transaction hash becomes the `paymentTxHash` recorded in the HCS proof message, linking the payment to the notarization without requiring server-side custody of funds.

### Explicit wallet selection

The app uses **in-memory (non-persistent) wagmi storage**. The wallet disconnects on every page refresh — the AppKit modal always shows the full wallet list. No silent auto-reconnect to MetaMask or any previously connected wallet.

### Payment flow

```
Click "Select wallet"
    ↓
AppKit disconnect() — clears any existing connection
    ↓
AppKit modal opens — MetaMask / Rainbow / Coinbase / QR
    ↓
User selects wallet
    ↓
switchNetwork(Polygon Amoy)
    ↓
sendTransaction({ value: 0.001 MATIC, data: memo })
    ↓
waitForTransactionReceipt()
    ↓
stampOnHedera(txHash, address)
```

### Environment variables

```bash
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...   # https://cloud.reown.com
NEXT_PUBLIC_POLYGON_RECEIVER=0x...         # address that receives payments
```

---

## Setup

```bash
# 1. Install
npm install

# 2. Configure
cp .env.local.example .env.local
# Fill in Hedera, WalletConnect, and World ID credentials

# 3. Create HCS topic and HTS token collection
npm run setup

# 4. Run
npm run dev
```

If you get signature errors during setup:
```bash
node scripts/diagnose.js
```

---

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/submit` | Hash → HCS → HTS → HFS |
| `GET`  | `/api/verify?hash=` | Verify SHA-256 against the ledger |
| `GET`  | `/api/audit` | Recent HCS messages + NFTs from Mirror Node |
| `GET`  | `/api/certificate?fileId=` | Serve HTML certificate from HFS |
| `GET`  | `/api/status` | Hedera config and token info |
| `POST` | `/api/world/signature` | Generate World ID RP signature |
| `POST` | `/api/world/verify` | Verify World ID proof, set session cookie |
| `GET`  | `/api/world/logout` | Clear session cookie |
| `POST` | `/api/account/create` | Create a Hedera account |
| `POST` | `/api/account/associate` | Associate account with PCP token |

---

## License

MIT