"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuthModal } from "@/lib/authModalContext";

// ── Types ─────────────────────────────────────────────────────────────────────

interface ZKEntry {
  seq: number;
  hash: string;
  filename: string;
  nullifier: string;
  ts: string;
}

interface EntryData {
  seq: number;
  ts: string;
  fn?: string;
  hash?: string;
  mode: "public" | "anon" | "nft";
  serialNumber?: number;
  accountId?: string;
  nftMeta?: { h?: string; seq?: number; f?: string };
  /** HFS file ID — present when a certificate has been uploaded for this entry */
  fileId?: string | null;
}

interface Props {
  refreshTrigger: number;
  newZKEntry?: ZKEntry | null;
}

type Tab = "all" | "nft" | "anon";

// ── Seed data (no fileId — certificates only exist for real on-chain entries) ─

const SEED: EntryData[] = [
  { seq: 24, ts: "Mar 28, 14:32", fn: "contract-final-v3.pdf",        hash: "a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1", mode: "public" },
  { seq: 23, ts: "Mar 28, 11:07", fn: "patent-application-2025.docx", hash: "c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8", mode: "public" },
  { seq: 22, ts: "Mar 27, 09:15", fn: "whistleblower-report.txt",      hash: "f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1", mode: "anon"   },
];

function fmtTs(ts: string) {
  if (!ts) return "—";
  const d = new Date(parseFloat(ts) * 1000);
  return d.toLocaleDateString("en", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

const HASHSCAN = "https://hashscan.io/testnet";

function links(topicId: string, tokenId: string, entry: EntryData) {
  const out: { label: string; url: string; icon: string }[] = [];
  const cleanTopicId = topicId?.trim() ?? "";
  const cleanTokenId = tokenId?.trim() ?? "";
  if (cleanTopicId) out.push({ label: "HCS Topic",      url: `${HASHSCAN}/topic/${cleanTopicId}`,                         icon: "⬡" });
  if (cleanTokenId) out.push({ label: "NFT Collection", url: `${HASHSCAN}/token/${cleanTokenId}`,                         icon: "🪙" });
  if (cleanTokenId && entry.serialNumber)
    out.push({ label: `NFT Serial #${entry.serialNumber}`, url: `${HASHSCAN}/token/${cleanTokenId}/${entry.serialNumber}`, icon: "📜" });
  return out;
}

// ── Detail Modal ──────────────────────────────────────────────────────────────

function DetailModal({
  entry, topicId, tokenId, onClose,
}: {
  entry: EntryData; topicId: string; tokenId: string; onClose: () => void;
}) {
  const isAnon = entry.mode === "anon";
  const isNft  = entry.mode === "nft";
  const entryLinks = links(topicId, tokenId, entry);

  // Construct certificate URL from fileId (relative — works on same origin)
  const certificateUrl = entry.fileId ? `/api/certificate?fileId=${entry.fileId}` : null;
  const hfsExplorerUrl = entry.fileId ? `${HASHSCAN}/file/${entry.fileId}` : null;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
        zIndex: 200,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "20px",
        animation: "fadein 0.18s ease",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#fff", borderRadius: 16,
          width: "100%", maxWidth: 520,
          overflow: "hidden",
          boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
          animation: "slideUp 0.22s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px 16px",
            borderBottom: "0.5px solid var(--bd)",
            background: isAnon ? "var(--p-lt)" : isNft ? "var(--teal-lt)" : "var(--bg2)",
            display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 20, color: "#fff",
                background: isAnon ? "var(--p)" : isNft ? "var(--teal)" : "var(--blue)",
                boxShadow: isAnon
                  ? "0 4px 14px rgba(127,119,221,0.4)"
                  : isNft
                  ? "0 4px 14px rgba(29,158,117,0.4)"
                  : "0 4px 14px rgba(55,138,221,0.4)",
              }}
            >
              {isAnon ? "🔒" : isNft ? "🪙" : "📄"}
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--t0)", marginBottom: 4 }}>
                {isNft ? `Notary Certificate #${entry.serialNumber ?? entry.seq}` : entry.fn ?? "Document"}
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 500, color: "#fff",
                  background: isAnon ? "var(--p)" : isNft ? "var(--teal)" : "var(--blue)",
                }}>
                  {isAnon ? "Anonymous" : isNft ? "NFT Certificate" : "Public"}
                </span>
                <span style={{
                  fontSize: 11, padding: "2px 9px", borderRadius: 20, fontWeight: 500,
                  background: "rgba(0,0,0,0.07)", color: "var(--t1)",
                }}>
                  {isNft ? `Serial #${entry.seq}` : `HCS #${entry.seq}`}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: "50%", border: "none",
              background: "rgba(0,0,0,0.07)", color: "var(--t2)",
              fontSize: 18, cursor: "pointer", display: "flex",
              alignItems: "center", justifyContent: "center", flexShrink: 0, lineHeight: 1,
            }}
          >×</button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px" }}>
          <DetailRow label="Recorded at" value={entry.ts} />
          {entry.fn && !isNft && <DetailRow label="Filename" value={entry.fn} />}
          {isNft && entry.accountId && <DetailRow label="Owner" value={entry.accountId} mono />}

          {entry.hash && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: "var(--t2)", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.5px" }}>
                SHA-256 Fingerprint
              </div>
              <div style={{
                fontFamily: "var(--mono)", fontSize: 11,
                color: isAnon ? "var(--p-dk)" : "var(--t1)",
                wordBreak: "break-all",
                background: isAnon ? "var(--p-lt)" : "var(--bg2)",
                borderRadius: 8, padding: "10px 12px", lineHeight: 1.7,
                border: `0.5px solid ${isAnon ? "var(--p-mid)" : "var(--bd)"}`,
              }}>
                {entry.hash}
              </div>
            </div>
          )}

          {isAnon && (
            <div style={{
              display: "flex", gap: 8, padding: "10px 12px", borderRadius: 8,
              background: "var(--p-lt)", border: "0.5px solid var(--p-mid)", marginBottom: 16,
            }}>
              <span style={{ fontSize: 14, flexShrink: 0 }}>🔒</span>
              <span style={{ fontSize: 12, color: "var(--p-dk)", lineHeight: 1.6 }}>
                Submitted via Unlink ZK. The submitter identity is cryptographically shielded —
                the document hash is public and verifiable, your identity never is.
              </span>
            </div>
          )}

          {/* ── Certificate section ── */}
          {certificateUrl ? (
            <div style={{
              marginBottom: 16, padding: "14px 16px", borderRadius: 10,
              background: "var(--p-lt)", border: "0.5px solid var(--p-mid)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 15 }}>📁</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--p-dk)" }}>
                  Certificate on Hedera File Service
                </span>
                <span style={{
                  fontSize: 10, padding: "1px 7px", borderRadius: 20,
                  background: "var(--p)", color: "#fff", fontWeight: 600, letterSpacing: "0.5px",
                }}>HFS</span>
              </div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--p-dk)", marginBottom: 12 }}>
                {entry.fileId}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <a
                  href={certificateUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 6,
                    padding: "8px 16px", borderRadius: "var(--r)",
                    background: "var(--p)", color: "#fff",
                    fontSize: 13, fontWeight: 600, textDecoration: "none",
                  }}
                >
                  📥 Open Certificate
                </a>
                {hfsExplorerUrl && (
                  <a
                    href={hfsExplorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6,
                      padding: "8px 14px", borderRadius: "var(--r)",
                      background: "transparent", color: "var(--p-dk)",
                      fontSize: 12, fontWeight: 500, textDecoration: "none",
                      border: "0.5px solid var(--p-mid)",
                    }}
                  >
                    ⬡ HashScan ↗
                  </a>
                )}
              </div>
            </div>
          ) : (
            <div style={{
              marginBottom: 16, padding: "10px 12px", borderRadius: 8,
              background: "var(--bg2)", border: "0.5px solid var(--bd)",
              display: "flex", alignItems: "center", gap: 8,
            }}>
              <span style={{ fontSize: 13 }}>📄</span>
              <span style={{ fontSize: 12, color: "var(--t2)" }}>
                Certificate not available — submitted before HFS integration or upload failed.
              </span>
            </div>
          )}

          {/* Divider */}
          <div style={{ height: "0.5px", background: "var(--bd)", margin: "4px 0 16px" }} />

          {/* HashScan links */}
          <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t2)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            View on HashScan
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {entryLinks.map((l) => (
              <a
                key={l.label} href={l.url} target="_blank" rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: "0.5px solid var(--bd2)", background: "var(--bg2)",
                  textDecoration: "none", transition: "all 0.15s", color: "var(--t0)",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "var(--p-lt)"; e.currentTarget.style.borderColor = "var(--p-mid)"; }}
                onMouseOut={(e)  => { e.currentTarget.style.background = "var(--bg2)";  e.currentTarget.style.borderColor = "var(--bd2)"; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 15 }}>{l.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>{l.label}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--p)", fontWeight: 600 }}>↗</span>
              </a>
            ))}

            {topicId && entry.seq && !isNft && (
              <a
                href={`${HASHSCAN}/topic/${topicId}?sequenceNumber=${entry.seq}`}
                target="_blank" rel="noreferrer"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "10px 14px", borderRadius: 10,
                  border: "0.5px solid var(--bd2)", background: "var(--bg2)",
                  textDecoration: "none", transition: "all 0.15s", color: "var(--t0)",
                }}
                onMouseOver={(e) => { e.currentTarget.style.background = "var(--teal-lt)"; e.currentTarget.style.borderColor = "var(--teal)"; }}
                onMouseOut={(e)  => { e.currentTarget.style.background = "var(--bg2)";     e.currentTarget.style.borderColor = "var(--bd2)"; }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <span style={{ fontSize: 15 }}>🔍</span>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>HCS Message #{entry.seq}</span>
                </span>
                <span style={{ fontSize: 12, color: "var(--teal-dk)", fontWeight: 600 }}>↗</span>
              </a>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 24px", borderTop: "0.5px solid var(--bd)", background: "var(--bg2)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: 11, color: "var(--t3)" }}>
            Hedera {process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? "testnet"} · Immutable record
          </span>
          <button
            onClick={onClose}
            style={{
              padding: "6px 16px", borderRadius: "var(--r)",
              border: "0.5px solid var(--bd2)", background: "#fff",
              fontSize: 12, fontWeight: 500, color: "var(--t1)",
              cursor: "pointer", fontFamily: "var(--sans)",
            }}
          >Close</button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
      <span style={{ fontSize: 11, fontWeight: 500, color: "var(--t2)", minWidth: 90, flexShrink: 0, paddingTop: 1, textTransform: "uppercase", letterSpacing: "0.4px" }}>
        {label}
      </span>
      <span style={{ fontSize: mono ? 11 : 13, fontFamily: mono ? "var(--mono)" : "var(--sans)", color: "var(--t0)", wordBreak: "break-all", lineHeight: 1.5 }}>
        {value}
      </span>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function HederaDashboard({ refreshTrigger, newZKEntry }: Props) {
  const [tab, setTab]               = useState<Tab>("all");
  const [entries, setEntries]       = useState<EntryData[]>(SEED);
  const [nfts, setNfts]             = useState<any[]>([]);
  const [zks, setZks]               = useState<ZKEntry[]>([]);
  const [loading, setLoading]       = useState(false);
  const [vHash, setVHash]           = useState("");
  const [vRes, setVRes]             = useState<{ ok: boolean; msg: string } | null>(null);
  const [vBusy, setVBusy]           = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<EntryData | null>(null);
  const [metrics, setMetrics]       = useState({ total: 24, topic: "0.0.4891234", token: "0.0.4891235", anon: 3 });
  const { open: openAuthModal }     = useAuthModal();

  useEffect(() => {
    if (newZKEntry) {
      setZks((p) => [newZKEntry, ...p]);
      setEntries((p) => [{
        seq: newZKEntry.seq, ts: newZKEntry.ts,
        fn: newZKEntry.filename, hash: newZKEntry.hash,
        mode: "anon", fileId: null,
      }, ...p]);
      setMetrics((m) => ({ ...m, total: m.total + 1, anon: m.anon + 1 }));
    }
  }, [newZKEntry]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      const d   = await res.json();
      if (d.messages?.length) {
        setEntries(
          d.messages.map((m: any) => ({
            seq:    m.sequenceNumber,
            ts:     fmtTs(m.consensusTimestamp),
            fn:     m.message?.filename,
            hash:   m.message?.docHash,
            mode:   m.message?.privateSubmission ? "anon" : "public",
            fileId: m.message?.hfsFileId ?? null,
          })),
        );
      }
      if (d.nfts?.length) setNfts(d.nfts);
      const st = await fetch("/api/status").then((r) => r.json()).catch(() => null);
      if (st?.status === "configured" && st?.topicId && st?.tokenId) {
        setMetrics((m) => ({ 
          ...m, 
          total: st.totalMinted ?? m.total, 
          topic: st.topicId.trim(),
          token: st.tokenId.trim(),
        }));
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { if (refreshTrigger > 0) load(); }, [load, refreshTrigger]);

  async function verify() {
    const h = vHash.trim(); if (!h) return;
    if (!/^[0-9a-f]{64}$/i.test(h)) {
      setVRes({ ok: false, msg: "Please enter a valid 64-character SHA-256 hash." });
      return;
    }
    setVBusy(true); setVRes(null);
    try {
      const res = await fetch(`/api/verify?hash=${encodeURIComponent(h)}`);
      const d   = await res.json();
      if (!res.ok) {
        setVRes({ ok: false, msg: d.error ?? `Server error (${res.status})` });
      } else {
        setVRes(d.verified
          ? { ok: true,  msg: `✓ Document is notarized · HCS sequence #${d.proof?.sequenceNumber}` }
          : { ok: false, msg: "Not found — this document has not been notarized." },
        );
      }
    } catch (err: any) {
      setVRes({ ok: false, msg: `Query failed: ${err.message ?? "network error"}` });
    }
    setVBusy(false);
  }

  const card = { background: "#fff", border: "0.5px solid var(--bd)", borderRadius: "var(--r-lg)", overflow: "hidden" };
  const metricCard = { background: "var(--bg2)", borderRadius: "var(--r)", padding: "14px 16px" };

  return (
    <>
      {selectedEntry && (
        <DetailModal
          entry={selectedEntry}
          topicId={metrics.topic}
          tokenId={metrics.token}
          onClose={() => setSelectedEntry(null)}
        />
      )}

      <div>
        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginBottom: 16 }}>
          {[
            { label: "Documents notarized", val: metrics.total, sub: "on Hedera testnet",  color: "var(--p)" },
            { label: "HCS topic",           val: metrics.topic, sub: `sequence #${metrics.total}`, color: "var(--t0)", small: true },
            { label: "NFT certificates",    val: metrics.total, sub: "HTS token PCP",      color: "var(--teal-dk)" },
          ].map((m) => (
            <div key={m.label} style={metricCard}>
              <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>{m.label}</div>
              <div style={{ fontSize: (m as any).small ? 13 : 22, fontWeight: 500, color: m.color, lineHeight: 1.2 }}>{m.val}</div>
              <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>{m.sub}</div>
            </div>
          ))}
        </div>

        {/* Register table */}
        <div style={card}>
          <div style={{ padding: "14px 20px", borderBottom: "0.5px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>Notary register</div>
              <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 1 }}>
                Live from Hedera Mirror Node · public · immutable ·{" "}
                <span style={{ color: "var(--p)" }}>click any row for details + certificate</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => openAuthModal()} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, color: "#fff", background: "var(--p)", border: "none", borderRadius: "var(--r)", cursor: "pointer" }}>
                🔐 Authentication
              </button>
              <button onClick={load} style={{ padding: "7px 14px", fontSize: 12, fontWeight: 500, color: "var(--p)", background: "var(--p-lt)", border: "none", borderRadius: "var(--r)", cursor: "pointer" }}>
                {loading ? "Refreshing…" : "↻ Refresh"}
              </button>
            </div>
          </div>

          {/* Verify */}
          <div style={{ padding: "12px 20px", borderBottom: "0.5px solid var(--bd)", background: "var(--bg2)" }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: "var(--t1)", marginBottom: 8 }}>Verify a document</div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={vHash} onChange={(e) => setVHash(e.target.value)}
                placeholder=" Paste the SHA-256 hash of any document to verify it"
                onKeyDown={(e) => e.key === "Enter" && verify()}
                style={{ flex: 1, marginBottom: 0, borderRadius: "var(--r)", border: "0.5px solid var(--bd)", padding: "10px 14px", fontSize: 13, fontFamily: "var(--mono)", color: "var(--t0)" }} 
              />
              <button onClick={verify} disabled={vBusy} style={{ padding: "10px 18px", borderRadius: "var(--r)", background: "var(--p)", color: "#fff", border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" }}>
                {vBusy ? "…" : "Verify"}
              </button>
            </div>
            {vRes && (
              <div className="fadein" style={{ marginTop: 8, fontSize: 13, padding: "9px 12px", borderRadius: "var(--r)", background: vRes.ok ? "var(--teal-lt)" : "var(--red-lt)", color: vRes.ok ? "var(--teal-dk)" : "var(--red-dk)", fontWeight: 500 }}>
                {vRes.msg}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", borderBottom: "0.5px solid var(--bd)" }}>
            {([["all", "All notarizations"], ["nft", "Certificates (NFT)"]] as [Tab, string][]).map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, padding: "10px 8px", fontSize: 13, fontWeight: tab === id ? 500 : 400, color: tab === id ? "var(--p)" : "var(--t2)", background: tab === id ? "var(--p-lt)" : "transparent", border: "none", borderRight: "0.5px solid var(--bd)", cursor: "pointer", fontFamily: "var(--sans)", transition: "all 0.15s" }}>
                {label}
              </button>
            ))}
          </div>

          {/* Entries */}
          <div>
            {tab === "all" && (
              entries.length === 0
                ? <EmptyState msg="No notarizations yet. Submit your first document above." />
                : entries.map((e, i) => <Entry key={i} entry={e} onClick={() => setSelectedEntry(e)} />)
            )}

            {tab === "nft" && (
              nfts.length === 0
                ? <EmptyState msg="NFT certificate data loads after your first notarization." />
                : nfts.map((n: any, i: number) => {
                    const nftEntry: EntryData = {
                      seq: n.serialNumber, ts: fmtTs(n.createdTimestamp),
                      fn: `Notary Certificate — ${n.metadata?.f ?? ""}`,
                      hash: n.metadata?.h ? n.metadata.h + "… (truncated in NFT metadata)" : undefined,
                      mode: "nft", serialNumber: n.serialNumber, accountId: n.accountId,
                      nftMeta: n.metadata, fileId: null,
                    };
                    return <Entry key={i} entry={nftEntry} onClick={() => setSelectedEntry(nftEntry)} />;
                  })
            )}

            {tab === "anon" && (
              zks.length === 0
                ? <div style={{ padding: "20px", fontSize: 13, color: "var(--t2)", lineHeight: 1.7 }}>
                    No anonymous notarizations yet. Choose <b>Unlink ZK</b> in the payment step to submit privately.
                  </div>
                : zks.map((z, i) => {
                    const zkEntry: EntryData = { seq: z.seq, ts: z.ts, fn: z.filename + " (anonymous)", hash: z.hash, mode: "anon", fileId: null };
                    return <Entry key={i} entry={zkEntry} onClick={() => setSelectedEntry(zkEntry)} />;
                  })
            )}
          </div>

          <div style={{ padding: "10px 20px", borderTop: "0.5px solid var(--bd)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--t2)" }}>
              Showing {Math.min(entries.length, 10)} of {metrics.total} notarizations
            </span>
            <a href={`${HASHSCAN}/topic/${metrics.topic}`} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--p)", fontWeight: 500, textDecoration: "none" }}>
              View all on HashScan ↗
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Entry row ─────────────────────────────────────────────────────────────────

function Entry({ entry, onClick }: { entry: EntryData; onClick: () => void }) {
  const { seq, ts, fn, hash, mode, fileId } = entry;
  const isAnon = mode === "anon";
  const isNft  = mode === "nft";

  return (
    <div
      className="fadein"
      onClick={onClick}
      title="Click to view details and open certificate"
      style={{
        display: "grid", gridTemplateColumns: "40px 1fr auto",
        gap: 12, alignItems: "start",
        padding: "13px 20px", borderBottom: "0.5px solid var(--bd)",
        cursor: "pointer", transition: "background 0.12s", userSelect: "none",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg2)")}
      onMouseOut={(e)  => (e.currentTarget.style.background = "transparent")}
    >
      {/* Avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 11, fontWeight: 500,
        background: isAnon ? "var(--p-lt)" : isNft ? "var(--teal-lt)" : "var(--bg2)",
        color:      isAnon ? "var(--p-dk)" : isNft ? "var(--teal-dk)" : "var(--t2)",
      }}>
        {isNft ? "N" : "#"}{seq}
      </div>

      {/* Content */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--t0)", marginBottom: 3 }}>{fn}</div>
        <div style={{ fontSize: 11, fontFamily: "var(--mono)", color: "var(--t3)", wordBreak: "break-all", marginBottom: 4 }}>{hash}</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {isAnon && <Badge label="Anonymous"      bg="var(--p-lt)"    c="var(--p-dk)"    />}
          {!isAnon && !isNft && <Badge label="Public"       bg="var(--teal-lt)" c="var(--teal-dk)" />}
          {!isAnon && !isNft && <Badge label="WalletConnect" bg="var(--blue-lt)" c="var(--blue-dk)" />}
          {isNft && <Badge label="NFT certificate" bg="var(--teal-lt)" c="var(--teal-dk)" />}
          {/* Certificate badge */}
          {fileId && <Badge label="📁 Certificate" bg="var(--p-lt)" c="var(--p-dk)" />}
        </div>
      </div>

      {/* Right: time + arrow */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, paddingTop: 2 }}>
        <span style={{ fontSize: 11, color: "var(--t3)", whiteSpace: "nowrap" }}>{ts}</span>
        <span style={{ fontSize: 12, color: "var(--p)", opacity: 0.6 }}>↗</span>
      </div>
    </div>
  );
}

function Badge({ label, bg, c }: { label: string; bg: string; c: string }) {
  return (
    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20, background: bg, color: c, fontWeight: 500 }}>
      {label}
    </span>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return <div style={{ padding: "20px", fontSize: 13, color: "var(--t2)" }}>{msg}</div>;
}