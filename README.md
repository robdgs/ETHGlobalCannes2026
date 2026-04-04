# ProvenanceChain

**On-chain notary. No lawyer. No office. Just the ledger.**

ProvenanceChain lets anyone certify that a document existed at a specific point in time. Upload a file or paste text — we compute its SHA-256 fingerprint locally, stamp it on Hedera's public ledger, and issue a verifiable certificate stored permanently on-chain. Your file never leaves your device.

---

## What it does

1. **Compute** — SHA-256 fingerprint calculated in the browser. The document itself is never transmitted.
2. **Pay** — WalletConnect (public) or Unlink ZK (anonymous). Payment proves intent without storing the document.
3. **Stamp** — Fingerprint published to Hedera Consensus Service. Ordered and timestamped by thousands of nodes.
4. **Certify** — NFT certificate minted on Hedera Token Service. HTML certificate stored immutably on Hedera File Service.
5. **Verify** — Anyone can verify any document hash against the public ledger at any time, forever.

---

## Tech stack

### Hedera — the trust layer

ProvenanceChain uses four native Hedera services, with no smart contracts required.

**Hedera Consensus Service (HCS)**
Every notarization is published as a message to a dedicated HCS topic. The network orders it, timestamps it with Byzantine fault-tolerant consensus, and makes it permanently queryable via the Mirror Node REST API. A second `CERTIFICATE_LINK` message links the document hash to its HFS file ID, making certificates discoverable retroactively.

**Hedera Token Service (HTS)**
Each notarization mints a unique NFT from the `PCP` collection. The NFT metadata references the document hash and HCS sequence number. NFTs can be transferred to the submitter's own Hedera account.

**Hedera File Service (HFS)**
After every successful notarization, a self-contained HTML certificate is uploaded to HFS. The file is immutable — no admin key means it cannot be deleted or modified. Certificates are served directly from `GET /api/certificate?fileId=0.0.XXXXX` and rendered in the browser. Files expire after one year (renewable).

**Hedera Scheduled Transactions**
A scheduled HBAR transfer is created as a reward for each notarization. The schedule can be countersigned later to release the reward.

**Mirror Node**
The dashboard queries the Hedera Mirror Node REST API in real time to populate the notary register, verify document hashes, and resolve `CERTIFICATE_LINK` messages to their HFS file IDs.

```
Submit document
    │
    ├─ HCS → publishProof()           # DOCUMENT_PROOF message
    ├─ HTS → mintProofToken()         # NFT serial #N
    ├─ Schedule → scheduleReward()    # deferred HBAR reward
    └─ HFS → uploadToHFS()
              └─ HCS → publishCertificateLink()  # CERTIFICATE_LINK message
```

---

### WalletConnect — payment and identity

Payment is handled by Reown AppKit (WalletConnect v3). Any EVM wallet is supported — MetaMask, Rainbow, Coinbase Wallet, or a mobile wallet via QR code.

The payment (0.001 MATIC on Polygon Amoy testnet) is sent with a memo field encoding the document hash:
```
PROVE:<sha256_hex>:<filename_base64>
```

The transaction hash becomes the `paymentTxHash` recorded in the HCS proof message, linking the payment to the notarization without requiring any server-side custody of funds.

**Explicit wallet selection** — the app intentionally uses in-memory (non-persistent) wagmi storage. The wallet disconnects on every page refresh, and the AppKit modal always shows the full wallet list. No silent auto-reconnect to MetaMask.

**Reown Authentication (SIWX)** — Sign-In With X is configured with `required: false`. Users can connect wallets for payment without mandatory signature authentication. The `AuthenticationPanel` component demonstrates session metadata storage for apps that want to extend this to full auth.

---

### Flare — price oracles and TEE attestation

**FTSO v2 Price Feeds**
Flare's Time Series Oracle provides live XRP/USD and HBAR/USD prices from the FastUpdater contract on Coston2. These are used to denominate the notarization fee in USD-equivalent terms and price XRPL Pay-to-Prove payments dynamically.

```typescript
// FastUpdater on Coston2: 0x70e8C12137680faB9400b6c9E33E7ba83c947A8b
getFeedById("0x015852502f55534400000000000000000000000000") // XRP/USD
getFeedById("0x01484241522f555344000000000000000000000000") // HBAR/USD
```

Set `FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc` to use live prices. Without it, the app falls back to static mock values.

**TEE Extensions (simulation)**
A Flare Trusted Execution Environment would independently fetch the HCS proof from the Mirror Node, verify that the document hash in the message matches the submitted hash, and return a signed attestation — a second, hardware-attested verification layer independent of ProvenanceChain's own server.

The current implementation simulates this locally using Ed25519 key generation and `crypto.sign(null, payload, privateKey)`. Set `FLARE_TEE_ENDPOINT` to point at a real TEE relay when one becomes available.

**Smart Account / XRPL Pay-to-Prove (simulation)**
The `ProvenanceChainSmartAccount.sol` contract (deployable to Coston2) implements the `ISmartWallet` interface. When deployed, XRPL users can send a payment to a linked XRPL address with a document hash in the memo field. The Flare Data Connector detects the payment and calls `handleXRPLPayment()`, triggering the full ProvenanceChain pipeline without requiring an EVM wallet.

Deploy with:
```bash
npm run deploy:contract
```

Then set `FLARE_SMART_ACCOUNT_ADDRESS` in `.env.local` to activate live mode.

---

### Unlink — anonymous submission

Unlink provides ZK-shielded payments on Base Sepolia. When a user chooses "Unlink ZK", the payment flow is:

1. `faucet.requestPrivateTokens()` — funds the Unlink pool account (no ETH for gas required in dev)
2. `withdraw()` — sends tokens to the ProvenanceChain receiver; on-chain the sender is the Unlink pool contract, not the user's wallet

The HCS message is published under a **stealth account** derived deterministically from the payment nullifier — not the user's real Hedera account. The NFT is minted to the stealth address. The TEE attestation receives `submitter: "PRIVATE"`. No layer of the proof chain records the real user identity.

---

## Setup

```bash
# 1. Clone and install
git clone https://github.com/your-org/provenancechain
cd provenancechain
npm install

# 2. Configure
cp .env.local.example .env.local
# Fill in HEDERA_OPERATOR_ID and HEDERA_OPERATOR_KEY
# Get a free testnet account at https://portal.hedera.com

# 3. Create HCS topic and HTS token
npm run setup

# 4. Run
npm run dev
```

### Environment variables

```bash
# Required — Hedera
HEDERA_OPERATOR_ID=0.0.12345
HEDERA_OPERATOR_KEY=302e...
HEDERA_NETWORK=testnet
HCS_TOPIC_ID=0.0.xxxxx        # created by npm run setup
HTS_TOKEN_ID=0.0.xxxxx        # created by npm run setup

# Required — WalletConnect
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=...   # https://cloud.reown.com

# Optional — Flare (live prices)
FLARE_RPC_URL=https://coston2-api.flare.network/ext/C/rpc
FLARE_OPERATOR_PRIVATE_KEY=0x...
FLARE_SMART_ACCOUNT_ADDRESS=0x...          # after npm run deploy:contract

# Optional — Unlink ZK (live payments)
UNLINK_LIVE_MODE=true
UNLINK_API_KEY=...                         # https://hackaton-apikey.vercel.app
UNLINK_OPERATOR_PRIVATE_KEY=0x...         # funded on Base Sepolia
UNLINK_USER_MNEMONIC=word1 word2 ...      # 12 BIP39 words

# Optional — app URL (for HFS certificate links)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Diagnostics

If you get signature errors during setup:

```bash
node scripts/diagnose.js
```

This compares the public key derived from your private key against the one registered on your Hedera account on the Mirror Node.

---

## API routes

| Method | Route | Description |
|--------|-------|-------------|
| `POST` | `/api/submit` | Hash → HCS → HTS → HFS → CERTIFICATE_LINK |
| `GET`  | `/api/verify?hash=` | Verify a SHA-256 hash against the ledger |
| `GET`  | `/api/audit` | Recent HCS messages + NFTs from Mirror Node |
| `GET`  | `/api/certificate?fileId=` | Serve HTML certificate from HFS |
| `GET`  | `/api/status` | Network config and token info |
| `POST` | `/api/account/create` | Create a new Hedera account |
| `POST` | `/api/account/associate` | Associate account with PCP token |
| `POST` | `/api/unlink/pay` | Private submission via Unlink ZK |
| `GET`  | `/api/unlink/status` | Unlink config and chain info |
| `GET`  | `/api/flare/price` | FTSO v2 price feeds |
| `POST` | `/api/flare/attest` | TEE attestation request |
| `POST` | `/api/flare/xrpl-trigger` | Simulate XRPL Pay-to-Prove |

---

## Verifying a document

Any document notarized through ProvenanceChain can be independently verified:

```bash
# Via the Mirror Node REST API directly
curl "https://testnet.mirrornode.hedera.com/api/v1/topics/{TOPIC_ID}/messages?limit=100" \
  | jq '.messages[] | select(.message | @base64d | fromjson | .docHash == "YOUR_HASH")'

# Via HashScan
https://hashscan.io/testnet/topic/{TOPIC_ID}
```

The proof is valid as long as the Hedera network exists. No dependency on ProvenanceChain's servers.

---

## License

MIT