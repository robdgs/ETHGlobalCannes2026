"use client";

import { useState } from "react";
import type { AccountResult } from "@/lib/types";

interface Props {
  onAccountCreated?: (accountId: string) => void;
}

export default function AccountPanel({ onAccountCreated }: Props) {
  const [initialHbar, setInitialHbar]     = useState(5);
  const [loading, setLoading]             = useState(false);
  const [associating, setAssociating]     = useState(false);
  const [result, setResult]               = useState<AccountResult | null>(null);
  const [associated, setAssociated]       = useState(false);
  const [error, setError]                 = useState("");

  const create = async () => {
    setLoading(true);
    setError("");
    setResult(null);
    setAssociated(false);
    try {
      const res  = await fetch("/api/account/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initialHbar }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setResult(data);
      onAccountCreated?.(data.accountId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const associate = async () => {
    if (!result) return;
    setAssociating(true);
    try {
      const res = await fetch("/api/account/associate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: result.accountId, privateKey: result.privateKey }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setAssociated(true);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAssociating(false);
    }
  };

  return (
    <section className="card">
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Create a Hedera account</h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
        Provision a new account on-chain using native <code style={{ fontFamily: "var(--font-geist-mono)", fontSize: 11 }}>AccountCreateTransaction</code>, funded with testnet HBAR.
      </p>

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Initial balance (HBAR, max 10)</label>
        <input
          type="number"
          value={initialHbar}
          onChange={(e) => setInitialHbar(Math.min(10, Math.max(1, Number(e.target.value))))}
          min={1} max={10}
          className="input-field"
          style={{ width: 120 }}
        />
      </div>

      <button className="btn-ghost" style={{ width: "100%" }} onClick={create} disabled={loading}>
        {loading
          ? <><span className="spinner" style={{ marginRight: 8 }} />Creating account…</>
          : "Create account"}
      </button>

      {error && (
        <div style={{
          marginTop: 12, padding: "10px 14px", borderRadius: 8,
          background: "rgba(240,101,67,0.08)", border: "0.5px solid rgba(240,101,67,0.3)",
          color: "var(--hedera-coral)", fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {result && (
        <div className="animate-slide-up" style={{
          marginTop: 14,
          border: "0.5px solid rgba(10,191,163,0.25)",
          borderRadius: 10, overflow: "hidden",
        }}>
          <div style={{
            background: "rgba(10,191,163,0.05)", padding: "10px 14px",
            borderBottom: "0.5px solid var(--border)",
          }}>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 2 }}>New account ID</div>
            <div style={{
              fontFamily: "var(--font-geist-mono)", fontSize: 15,
              fontWeight: 600, color: "var(--hedera-teal)",
            }}>
              {result.accountId}
            </div>
          </div>

          <div style={{ padding: "12px 14px", fontSize: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            <Row label="Balance"    value={result.initialBalance} />
            <Row label="Public key" value={result.publicKey} mono truncate />
            <a href={result.explorerLink} target="_blank" rel="noopener noreferrer"
              style={{ color: "var(--hedera-purple)", fontSize: 12, textDecoration: "none" }}>
              View on HashScan ↗
            </a>

            <div style={{
              marginTop: 4, padding: "6px 10px", borderRadius: 6,
              background: "rgba(244,167,42,0.08)", border: "0.5px solid rgba(244,167,42,0.25)",
              color: "var(--hedera-amber)", fontSize: 11,
            }}>
              ⚠ {result.warning}
            </div>

            {!associated ? (
              <button className="btn-ghost" style={{ marginTop: 4, fontSize: 12 }}
                onClick={associate} disabled={associating}>
                {associating
                  ? <><span className="spinner" style={{ marginRight: 8 }} />Associating…</>
                  : "Associate with proof NFT collection →"}
              </button>
            ) : (
              <div style={{ color: "var(--hedera-teal)", fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                ✅ Associated — account can receive proof NFTs
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Row({ label, value, mono, truncate }: {
  label: string; value: string; mono?: boolean; truncate?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span style={{ color: "var(--text-secondary)", minWidth: 70, flexShrink: 0 }}>{label}</span>
      <span style={{
        fontFamily: mono ? "var(--font-geist-mono)" : "inherit",
        fontSize: mono ? 11 : 12,
        color: "var(--text-primary)",
        wordBreak: "break-all",
        ...(truncate ? { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220 } : {}),
      }}>
        {value}
      </span>
    </div>
  );
}
