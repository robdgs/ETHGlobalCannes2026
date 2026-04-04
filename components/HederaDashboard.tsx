"use client";
import { useState, useEffect, useCallback } from "react";
import { useAuthModal } from "@/lib/authModalContext";

interface ZKEntry {
  seq: number;
  hash: string;
  filename: string;
  nullifier: string;
  ts: string;
}
interface Props {
  refreshTrigger: number;
  newZKEntry?: ZKEntry | null;
}

type Tab = "all" | "nft" | "anon";

const SEED: any[] = [
  {
    seq: 24,
    ts: "Mar 28, 14:32",
    fn: "contract-final-v3.pdf",
    hash: "a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    mode: "public",
  },
  {
    seq: 23,
    ts: "Mar 28, 11:07",
    fn: "patent-application-2025.docx",
    hash: "c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8",
    mode: "public",
  },
  {
    seq: 22,
    ts: "Mar 27, 09:15",
    fn: "whistleblower-report.txt",
    hash: "f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
    mode: "anon",
  },
];

function fmtTs(ts: string) {
  if (!ts) return "—";
  const d = new Date(parseFloat(ts) * 1000);
  return d.toLocaleDateString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function HederaDashboard({ refreshTrigger, newZKEntry }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [entries, setEntries] = useState<any[]>(SEED);
  const [nfts, setNfts] = useState<any[]>([]);
  const [zks, setZks] = useState<ZKEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [vHash, setVHash] = useState("");
  const [vRes, setVRes] = useState<{ ok: boolean; msg: string } | null>(null);
  const [vBusy, setVBusy] = useState(false);
  const [metrics, setMetrics] = useState({
    total: 24,
    topic: "0.0.4891234",
    token: "0.0.4891235",
    anon: 3,
  });
  const { open: openAuthModal } = useAuthModal();

  useEffect(() => {
    if (newZKEntry) {
      setZks((p) => [newZKEntry, ...p]);
      setEntries((p) => [
        {
          seq: newZKEntry.seq,
          ts: newZKEntry.ts,
          fn: newZKEntry.filename,
          hash: newZKEntry.hash,
          mode: "anon",
        },
        ...p,
      ]);
      setMetrics((m) => ({ ...m, total: m.total + 1, anon: m.anon + 1 }));
    }
  }, [newZKEntry]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      const d = await res.json();
      if (d.messages?.length) {
        setEntries(
          d.messages.map((m: any) => ({
            seq: m.sequenceNumber,
            ts: fmtTs(m.consensusTimestamp),
            fn: m.message?.filename,
            hash: m.message?.docHash,
            mode: m.message?.privateSubmission ? "anon" : "public",
          })),
        );
      }
      if (d.nfts?.length) setNfts(d.nfts);
      const st = await fetch("/api/status")
        .then((r) => r.json())
        .catch(() => null);
      if (st?.totalMinted)
        setMetrics((m) => ({
          ...m,
          total: st.totalMinted,
          topic: st.topicId ?? m.topic,
          token: st.tokenId ?? m.token,
        }));
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    if (refreshTrigger > 0) load();
  }, [load, refreshTrigger]);

  async function verify() {
    const h = vHash.trim();
    if (!h) return;
    setVBusy(true);
    setVRes(null);
    try {
      const res = await fetch(`/api/verify?hash=${encodeURIComponent(h)}`);
      const d = await res.json();
      setVRes(
        d.verified
          ? {
              ok: true,
              msg: `✓ Document is notarized · HCS sequence #${d.proof?.sequenceNumber}`,
            }
          : {
              ok: false,
              msg: "Not found — this document has not been notarized.",
            },
      );
    } catch {
      setVRes({ ok: false, msg: "Query failed. Check your connection." });
    }
    setVBusy(false);
  }

  const card = {
    background: "#fff",
    border: "0.5px solid var(--bd)",
    borderRadius: "var(--r-lg)",
    overflow: "hidden",
  };
  const metricCard = {
    background: "var(--bg2)",
    borderRadius: "var(--r)",
    padding: "14px 16px",
  };

  return (
    <div>
      {/* Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4,1fr)",
          gap: 10,
          marginBottom: 16,
        }}
      >
        {[
          {
            label: "Documents notarized",
            val: metrics.total,
            sub: "on Hedera testnet",
            color: "var(--p)",
          },
          {
            label: "HCS topic",
            val: metrics.topic,
            sub: `sequence #${metrics.total}`,
            color: "var(--t0)",
            small: true,
          },
          {
            label: "NFT certificates",
            val: metrics.total,
            sub: "HTS token PCP",
            color: "var(--teal-dk)",
          },
          {
            label: "Anonymous",
            val: metrics.anon,
            sub: "via Unlink ZK",
            color: "var(--p-dk)",
          },
        ].map((m) => (
          <div key={m.label} style={metricCard}>
            <div style={{ fontSize: 12, color: "var(--t2)", marginBottom: 6 }}>
              {m.label}
            </div>
            <div
              style={{
                fontSize: m.small ? 13 : 22,
                fontWeight: 500,
                color: m.color,
                lineHeight: 1.2,
              }}
            >
              {m.val}
            </div>
            <div style={{ fontSize: 11, color: "var(--t3)", marginTop: 4 }}>
              {m.sub}
            </div>
          </div>
        ))}
      </div>

      {/* Register table */}
      <div style={card}>
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "0.5px solid var(--bd)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>
              Notary register
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)", marginTop: 1 }}>
              Live from Hedera Mirror Node · public · immutable
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => openAuthModal()}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: "#fff",
                background: "var(--p)",
                border: "none",
                borderRadius: "var(--r)",
                cursor: "pointer",
              }}
            >
              🔐 Authentication
            </button>
            <button
              onClick={load}
              style={{
                padding: "7px 14px",
                fontSize: 12,
                fontWeight: 500,
                color: "var(--p)",
                background: "var(--p-lt)",
                border: "none",
                borderRadius: "var(--r)",
                cursor: "pointer",
              }}
            >
              {loading ? "Refreshing…" : "↻ Refresh"}
            </button>
          </div>
        </div>

        {/* Verify */}
        <div
          style={{
            padding: "12px 20px",
            borderBottom: "0.5px solid var(--bd)",
            background: "var(--bg2)",
          }}
        >
          <div
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--t1)",
              marginBottom: 8,
            }}
          >
            Verify a document
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={vHash}
              onChange={(e) => setVHash(e.target.value)}
              placeholder="Paste the SHA-256 hash of any document to verify it"
              onKeyDown={(e) => e.key === "Enter" && verify()}
              style={{ flex: 1, marginBottom: 0 }}
            />
            <button
              onClick={verify}
              disabled={vBusy}
              style={{
                padding: "10px 18px",
                borderRadius: "var(--r)",
                background: "var(--p)",
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {vBusy ? "…" : "Verify"}
            </button>
          </div>
          {vRes && (
            <div
              className="fadein"
              style={{
                marginTop: 8,
                fontSize: 13,
                padding: "9px 12px",
                borderRadius: "var(--r)",
                background: vRes.ok ? "var(--teal-lt)" : "var(--red-lt)",
                color: vRes.ok ? "var(--teal-dk)" : "var(--red-dk)",
                fontWeight: 500,
              }}
            >
              {vRes.msg}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "0.5px solid var(--bd)" }}>
          {(
            [
              ["all", "All notarizations"],
              ["nft", "Certificates (NFT)"],
              ["anon", "Anonymous"],
            ] as [Tab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              style={{
                flex: 1,
                padding: "10px 8px",
                fontSize: 13,
                fontWeight: tab === id ? 500 : 400,
                color: tab === id ? "var(--p)" : "var(--t2)",
                background: tab === id ? "var(--p-lt)" : "transparent",
                border: "none",
                borderRight: "0.5px solid var(--bd)",
                cursor: "pointer",
                fontFamily: "var(--sans)",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Entries */}
        <div>
          {tab === "all" &&
            (entries.length === 0 ? (
              <EmptyState msg="No notarizations yet. Submit your first document above." />
            ) : (
              entries.map((e, i) => (
                <Entry
                  key={i}
                  seq={e.seq}
                  ts={e.ts}
                  fn={e.fn}
                  hash={e.hash}
                  mode={e.mode}
                />
              ))
            ))}
          {tab === "nft" &&
            (nfts.length === 0 ? (
              <EmptyState msg="NFT certificate data loads after your first notarization." />
            ) : (
              nfts.map((n: any, i: number) => (
                <Entry
                  key={i}
                  seq={n.serialNumber}
                  ts={fmtTs(n.createdTimestamp)}
                  fn={`Notary Certificate — ${n.metadata?.f}`}
                  hash={`Token 0.0.4891235 · Serial #${n.serialNumber}`}
                  mode="nft"
                />
              ))
            ))}
          {tab === "anon" &&
            (zks.length === 0 ? (
              <div
                style={{
                  padding: "20px",
                  fontSize: 13,
                  color: "var(--t2)",
                  lineHeight: 1.7,
                }}
              >
                No anonymous notarizations yet. Choose <b>Unlink ZK</b> in the
                payment step to submit privately. The document hash is public
                and verifiable — your identity is not.
              </div>
            ) : (
              zks.map((z, i) => (
                <Entry
                  key={i}
                  seq={z.seq}
                  ts={z.ts}
                  fn={z.filename + " (anonymous)"}
                  hash={`Nullifier: ${z.nullifier?.slice(0, 48)}…`}
                  mode="anon"
                />
              ))
            ))}
        </div>

        <div
          style={{
            padding: "10px 20px",
            borderTop: "0.5px solid var(--bd)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 12, color: "var(--t2)" }}>
            Showing {Math.min(entries.length, 10)} of {metrics.total}{" "}
            notarizations
          </span>
          <a
            href={`https://hashscan.io/testnet/topic/${metrics.topic}`}
            target="_blank"
            rel="noreferrer"
            style={{
              fontSize: 12,
              color: "var(--p)",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            View all on HashScan ↗
          </a>
        </div>
      </div>
    </div>
  );
}

function Entry({
  seq,
  ts,
  fn,
  hash,
  mode,
}: {
  seq: number;
  ts: string;
  fn?: string;
  hash?: string;
  mode: string;
}) {
  const isAnon = mode === "anon";
  const isNft = mode === "nft";
  return (
    <div
      className="fadein"
      style={{
        display: "grid",
        gridTemplateColumns: "40px 1fr auto",
        gap: 12,
        alignItems: "start",
        padding: "13px 20px",
        borderBottom: "0.5px solid var(--bd)",
        transition: "background 0.1s",
      }}
      onMouseOver={(e) => (e.currentTarget.style.background = "var(--bg2)")}
      onMouseOut={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 11,
          fontWeight: 500,
          flexShrink: 0,
          background: isAnon
            ? "var(--p-lt)"
            : isNft
            ? "var(--teal-lt)"
            : "var(--bg2)",
          color: isAnon
            ? "var(--p-dk)"
            : isNft
            ? "var(--teal-dk)"
            : "var(--t2)",
        }}
      >
        {isNft ? "N" : "#"}
        {seq}
      </div>
      <div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "var(--t0)",
            marginBottom: 3,
          }}
        >
          {fn}
        </div>
        <div
          style={{
            fontSize: 11,
            fontFamily: "var(--mono)",
            color: "var(--t3)",
            wordBreak: "break-all",
            marginBottom: 4,
          }}
        >
          {hash}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {isAnon && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 20,
                background: "var(--p-lt)",
                color: "var(--p-dk)",
                fontWeight: 500,
              }}
            >
              Anonymous
            </span>
          )}
          {!isAnon && !isNft && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 20,
                background: "var(--teal-lt)",
                color: "var(--teal-dk)",
                fontWeight: 500,
              }}
            >
              Public
            </span>
          )}
          {!isAnon && !isNft && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 20,
                background: "var(--blue-lt)",
                color: "var(--blue-dk)",
                fontWeight: 500,
              }}
            >
              WalletConnect
            </span>
          )}
          {isNft && (
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 20,
                background: "var(--teal-lt)",
                color: "var(--teal-dk)",
                fontWeight: 500,
              }}
            >
              NFT certificate
            </span>
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 11,
          color: "var(--t3)",
          whiteSpace: "nowrap",
          paddingTop: 2,
        }}
      >
        {ts}
      </div>
    </div>
  );
}

function EmptyState({ msg }: { msg: string }) {
  return (
    <div style={{ padding: "20px", fontSize: 13, color: "var(--t2)" }}>
      {msg}
    </div>
  );
}
