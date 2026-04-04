/**
 * lib/hedera/certificate.ts
 *
 * Generates a self-contained HTML notary certificate.
 * Designed to be stored on Hedera File Service (HFS) and served directly
 * in a browser — no external dependencies, print-ready, < 5 KB.
 */

export interface CertificateParams {
  filename: string;
  docHash: string;
  /** Hedera consensus timestamp string (e.g. "1743170331.000000000") */
  consensusTimestamp: string | null;
  topicId: string;
  sequenceNumber: number;
  tokenId: string;
  serialNumber: number;
  hcsTxId: string;
  htsTxId: string;
  isPrivate: boolean;
  network: string;
}

const HASHSCAN_BASE = (network: string) =>
  network === "mainnet" ? "https://hashscan.io" : "https://hashscan.io/testnet";

function fmtTimestamp(ts: string | null): string {
  if (!ts) return new Date().toUTCString();
  const d = new Date(parseFloat(ts) * 1000);
  return d.toUTCString();
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Returns a compact, self-contained HTML certificate (~4 KB).
 * Safe to store directly on HFS — no external requests.
 */
export function generateCertificateHTML(p: CertificateParams): string {
  const base = HASHSCAN_BASE(p.network);
  const topicUrl = `${base}/topic/${p.topicId}`;
  const tokenUrl = `${base}/token/${p.tokenId}/${p.serialNumber}`;
  const hcsTxUrl = `${base}/transaction/${encodeURIComponent(p.hcsTxId)}`;
  const issuedAt = fmtTimestamp(p.consensusTimestamp);
  const fn = escapeHtml(p.filename);
  const hash = escapeHtml(p.docHash);

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Notary Certificate &middot; ${fn}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f4f3ef;font-family:Georgia,'Times New Roman',serif;display:flex;justify-content:center;padding:32px 16px;min-height:100vh;color:#1a1a2e}
.c{background:#fff;max-width:660px;width:100%;border:1.5px solid #c9a55a;padding:48px 52px;position:relative}
.c::before{content:'';position:absolute;inset:10px;border:0.5px solid #ecdbb0;pointer-events:none}
.top{text-align:center;padding-bottom:28px;margin-bottom:32px;border-bottom:1px solid #ecdbb0}
.seal{width:60px;height:60px;background:linear-gradient(135deg,#7f77dd,#534ab7);border-radius:50%;margin:0 auto 18px;display:flex;align-items:center;justify-content:center;font-size:24px;color:#fff;box-shadow:0 4px 18px rgba(83,74,183,.3)}
h1{font-size:19px;letter-spacing:3px;text-transform:uppercase;font-weight:400;margin-bottom:8px}
.sub{font-size:10px;letter-spacing:4px;text-transform:uppercase;color:#a08040}
.lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:#a09070;margin-bottom:5px}
.val{font-size:14px;line-height:1.5;margin-bottom:20px}
.hash-box{font-family:'Courier New',monospace;font-size:10.5px;color:#534ab7;word-break:break-all;background:#f0efff;padding:12px 14px;border-left:3px solid #7f77dd;line-height:1.8;margin-bottom:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:4px}
.mono{font-family:'Courier New',monospace;font-size:12.5px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:5px 14px;font-size:10px;letter-spacing:1.5px;border:1px solid ${p.isPrivate ? "#7f77dd" : "#1d9e75"};color:${p.isPrivate ? "#534ab7" : "#0f6e56"};background:${p.isPrivate ? "#f0efff" : "#f0faf6"}}
.links{margin-top:20px;border-top:1px solid #ecdbb0;padding-top:20px}
.link-row{display:flex;align-items:baseline;gap:8px;margin-bottom:8px;font-size:11px}
.link-row span{color:#a09070;min-width:120px;flex-shrink:0;letter-spacing:.5px}
a{color:#534ab7;font-family:'Courier New',monospace;font-size:10.5px;word-break:break-all}
.footer{margin-top:28px;padding-top:20px;border-top:0.5px solid #ecdbb0;font-size:9.5px;color:#b09070;text-align:center;line-height:2;letter-spacing:.3px}
.stamp{position:absolute;top:44px;right:44px;width:72px;height:72px;border:2px solid ${p.isPrivate ? "#7f77dd" : "#1d9e75"};border-radius:50%;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:.18;transform:rotate(-15deg)}
.stamp div:first-child{font-size:18px}
.stamp div:last-child{font-size:7px;letter-spacing:2px;text-transform:uppercase;color:${p.isPrivate ? "#534ab7" : "#1d9e75"}}
@media print{body{background:#fff;padding:0}.c{max-width:100%}}
</style>
</head>
<body>
<div class="c">
  <div class="stamp"><div>${p.isPrivate ? "🔒" : "✓"}</div><div>${p.isPrivate ? "Private" : "Verified"}</div></div>

  <div class="top">
    <div class="seal">⬡</div>
    <h1>Certificate of Notarization</h1>
    <div class="sub">ProvenanceChain &middot; Hedera Hashgraph &middot; ${escapeHtml(p.network)}</div>
  </div>

  <div class="lbl">Document</div>
  <div class="val">${fn}</div>

  <div class="lbl">SHA-256 Fingerprint</div>
  <div class="hash-box">${hash}</div>

  <div class="grid">
    <div>
      <div class="lbl">Consensus Timestamp</div>
      <div class="val" style="font-size:13px">${escapeHtml(issuedAt)}</div>
    </div>
    <div>
      <div class="lbl">Submission Type</div>
      <div class="val"><span class="badge">${p.isPrivate ? "🔒 ANONYMOUS" : "✓ PUBLIC"}</span></div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="lbl">HCS Topic</div>
      <div class="val mono">${escapeHtml(p.topicId)}</div>
    </div>
    <div>
      <div class="lbl">HCS Sequence</div>
      <div class="val mono">#${p.sequenceNumber}</div>
    </div>
  </div>

  <div class="grid">
    <div>
      <div class="lbl">NFT Token</div>
      <div class="val mono">${escapeHtml(p.tokenId)}</div>
    </div>
    <div>
      <div class="lbl">NFT Serial</div>
      <div class="val mono">#${p.serialNumber}</div>
    </div>
  </div>

  <div class="links">
    <div class="lbl" style="margin-bottom:12px">Verify on Hedera HashScan</div>
    <div class="link-row"><span>HCS Proof</span><a href="${topicUrl}" target="_blank">${topicUrl}</a></div>
    <div class="link-row"><span>NFT Certificate</span><a href="${tokenUrl}" target="_blank">${tokenUrl}</a></div>
    <div class="link-row"><span>HCS Transaction</span><a href="${hcsTxUrl}" target="_blank">${escapeHtml(p.hcsTxId)}</a></div>
  </div>

  <div class="footer">
    This certificate proves that the above document existed at the stated consensus timestamp.<br>
    The SHA-256 fingerprint is permanently recorded on the Hedera public ledger and is immutable.<br>
    <strong>ProvenanceChain</strong> &mdash; On-chain Notary &mdash; Issued: ${escapeHtml(issuedAt)}
  </div>
</div>
</body>
</html>`;
}