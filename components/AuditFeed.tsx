"use client";

import { useState, useEffect, useCallback } from "react";
import type { AuditData, HCSMessage, NFTRecord } from "@/lib/types";

interface Props {
  refreshTrigger: number;
}

export default function AuditFeed({ refreshTrigger }: Props) {
  const [data, setData]       = useState<AuditData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState<"hcs" | "nft">("hcs");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/audit");
      if (res.ok) setData(await res.json());
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load, refreshTrigger]);

  const fmtTs = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000);
    return d.toLocaleString(undefined, {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  const messages = data?.messages ?? [];
  const nfts     = data?.nfts     ?? [];

  return (
    <section className="card" style={{ height: "fit-content" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Live audit trail</h2>
          <div className="pulse-dot" />
        </div>
        <button className="btn-ghost" style={{ padding: "4px 10px", fontSize: 12 }} onClick={load}>
          ↻ Refresh
        </button>
      </div>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.5 }}>
        Real-time feed from the Hedera Mirror Node REST API. Each entry is immutably ordered by the network.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
        <button className={`tab-btn ${tab === "hcs" ? "active" : ""}`} onClick={() => setTab("hcs")}>
          HCS proofs {messages.length > 0 && `(${messages.length})`}
        </button>
        <button className={`tab-btn ${tab === "nft" ? "active" : ""}`} onClick={() => setTab("nft")}>
          Proof NFTs {nfts.length > 0 && `(${nfts.length})`}
        </button>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="shimmer" style={{ height: 70, borderRadius: 8 }} />
          ))}
        </div>
      )}

      {/* Empty */}
      {!loading && messages.length === 0 && nfts.length === 0 && (
        <div style={{
          textAlign: "center", padding: "48px 20px",
          color: "var(--text-faint)", fontSize: 13,
        }}>
          No records yet — submit a document to get started.
        </div>
      )}

      {/* HCS messages */}
      {!loading && tab === "hcs" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {messages.map((m) => (
            <HCSEntry key={m.sequenceNumber} msg={m} fmtTs={fmtTs} />
          ))}
        </div>
      )}

      {/* NFTs */}
      {!loading && tab === "nft" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {nfts.map((n) => (
            <NFTEntry key={n.serialNumber} nft={n} fmtTs={fmtTs} />
          ))}
        </div>
      )}
    </section>
  );
}

function HCSEntry({ msg, fmtTs }: { msg: HCSMessage; fmtTs: (ts: string) => string }) {
  const m = msg.message;
  return (
    <div className="card-raised animate-slide-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="badge badge-purple" style={{ fontFamily: "var(--font-geist-mono)" }}>
          #{msg.sequenceNumber}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {fmtTs(msg.consensusTimestamp)}
        </span>
      </div>
      {m.filename && (
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 3 }}>
          📄 {m.filename}
        </div>
      )}
      {m.docHash && (
        <div style={{
          fontFamily: "var(--font-geist-mono)", fontSize: 10,
          color: "var(--text-faint)", wordBreak: "break-all", marginBottom: 4,
        }}>
          {m.docHash}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {m.submitter && <span className="badge badge-gray">From: {m.submitter}</span>}
        {m.type      && <span className="badge badge-gray">{m.type}</span>}
      </div>
    </div>
  );
}

function NFTEntry({ nft, fmtTs }: { nft: NFTRecord; fmtTs: (ts: string) => string }) {
  const meta = nft.metadata;
  return (
    <div className="card-raised animate-slide-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span className="badge badge-coral" style={{ fontFamily: "var(--font-geist-mono)" }}>
          Serial #{nft.serialNumber}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-faint)" }}>
          {fmtTs(nft.createdTimestamp)}
        </span>
      </div>
      {meta.f && (
        <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 4 }}>
          🪙 {meta.f}
        </div>
      )}
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {nft.accountId && <span className="badge badge-gray">Owner: {nft.accountId}</span>}
        {meta.seq      && <span className="badge badge-gray">HCS seq #{meta.seq}</span>}
        {meta.h        && <span className="badge badge-gray" style={{ fontFamily: "var(--font-geist-mono)", fontSize: 10 }}>Hash: {meta.h}…</span>}
      </div>
    </div>
  );
}
