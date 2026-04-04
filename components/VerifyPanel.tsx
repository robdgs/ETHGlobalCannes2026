"use client";

import { useState } from "react";
import type { VerifyResult } from "@/lib/types";

export default function VerifyPanel() {
  const [hash, setHash]       = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState<VerifyResult | null>(null);

  const hashFile = async (f: File) => {
    const buf = await f.arrayBuffer();
    const dig = await crypto.subtle.digest("SHA-256", buf);
    const hex = Array.from(new Uint8Array(dig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setHash(hex);
    setResult(null);
  };

  const verify = async () => {
    if (!/^[0-9a-f]{64}$/i.test(hash.trim())) {
      setResult({ verified: false, message: "Enter a valid 64-character SHA-256 hex hash." });
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const res  = await fetch(`/api/verify?hash=${encodeURIComponent(hash.trim())}`);
      const data = await res.json();
      setResult(data);
    } catch (e: any) {
      setResult({ verified: false, message: e.message });
    } finally {
      setLoading(false);
    }
  };

  const fmtTs = (ts: string) => {
    const d = new Date(parseFloat(ts) * 1000);
    return d.toLocaleString(undefined, {
      year: "numeric", month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  };

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Verify a document</h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
        Drop a file to auto-compute its hash, or paste a SHA-256 hex string, then check the Hedera ledger.
      </p>

      <div style={{ marginBottom: 12 }}>
        <label className="field-label">SHA-256 hash (64 hex chars)</label>
        <input
          type="text"
          value={hash}
          onChange={(e) => { setHash(e.target.value); setResult(null); }}
          placeholder="a3f9b2c1…"
          className="input-field"
          style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12 }}
        />
      </div>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Or drop a file to compute hash</label>
        <input
          type="file"
          style={{ fontSize: 12, color: "var(--text-secondary)" }}
          onChange={(e) => { if (e.target.files?.[0]) hashFile(e.target.files[0]); }}
        />
      </div>

      <button className="btn-ghost" style={{ width: "100%" }} onClick={verify} disabled={loading}>
        {loading
          ? <><span className="spinner" style={{ marginRight: 8 }} />Querying Mirror Node…</>
          : "Check on-chain"}
      </button>

      {result && (
        <div
          className="animate-slide-up"
          style={{
            marginTop: 12,
            padding: "12px 14px",
            borderRadius: 8,
            fontSize: 13,
            lineHeight: 1.6,
            border: `0.5px solid ${result.verified ? "rgba(10,191,163,0.3)" : "rgba(240,101,67,0.3)"}`,
            background: result.verified ? "rgba(10,191,163,0.05)" : "rgba(240,101,67,0.05)",
            color: result.verified ? "var(--hedera-teal)" : "var(--hedera-coral)",
          }}
        >
          {result.verified && result.proof ? (
            <>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>✅ Proof verified on Hedera</div>
              <div style={{ color: "var(--text-secondary)", fontSize: 12 }}>
                <div>Consensus: <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>{fmtTs(result.proof.consensusTimestamp)}</code></div>
                <div>Sequence: <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>#{result.proof.sequenceNumber}</code></div>
                {result.proof.message?.filename && (
                  <div>File: <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>{result.proof.message.filename}</code></div>
                )}
                {result.mirrorUrl && (
                  <a href={result.mirrorUrl} target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--hedera-teal)", display: "inline-block", marginTop: 6 }}>
                    View on Mirror Node ↗
                  </a>
                )}
              </div>
            </>
          ) : (
            <div>⚠ {result.message ?? "No proof found for this hash."}</div>
          )}
        </div>
      )}
    </section>
  );
}
