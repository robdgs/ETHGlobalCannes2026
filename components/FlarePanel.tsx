"use client";

import { useState, useEffect } from "react";
import type { TEEAttestation, XRPLTriggerResponse, RewardPricing } from "@/lib/types";

interface Props {
  /** Pre-fill from a just-completed Hedera submission */
  lastProof?: {
    docHash:           string;
    filename:          string;
    hcsSequenceNumber: number;
  } | null;
}

export default function FlarePanel({ lastProof }: Props) {
  const [pricing, setPricing]           = useState<RewardPricing | null>(null);
  const [attestResult, setAttestResult] = useState<TEEAttestation | null>(null);
  const [xrplResult, setXrplResult]     = useState<XRPLTriggerResponse | null>(null);
  const [attestLoading, setAttestLoading] = useState(false);
  const [xrplLoading, setXrplLoading]     = useState(false);
  const [attestError, setAttestError]     = useState("");
  const [xrplError, setXrplError]         = useState("");

  // XRPL trigger form
  const [xrplSender, setXrplSender] = useState("rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh");
  const [xrplAmount, setXrplAmount] = useState("1");

  useEffect(() => {
    fetch("/api/flare/price")
      .then((r) => r.json())
      .then((d) => { if (d.pricing) setPricing(d.pricing); })
      .catch(() => {});
  }, []);

  const requestAttestation = async () => {
    if (!lastProof) return;
    setAttestLoading(true);
    setAttestError("");
    setAttestResult(null);
    try {
      const res  = await fetch("/api/flare/attest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          docHash:           lastProof.docHash,
          hcsTopicId:        null, // server uses env HCS_TOPIC_ID
          hcsSequenceNumber: lastProof.hcsSequenceNumber,
          filename:          lastProof.filename,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setAttestResult(data.attestation);
    } catch (e: any) {
      setAttestError(e.message);
    } finally {
      setAttestLoading(false);
    }
  };

  const triggerXRPL = async () => {
    if (!lastProof && !xrplSender) return;
    setXrplLoading(true);
    setXrplError("");
    setXrplResult(null);
    try {
      const res = await fetch("/api/flare/xrpl-trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          xrplSender,
          amountXRP:  parseFloat(xrplAmount) || 1,
          docHash:    lastProof?.docHash   ?? "a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",
          filename:   lastProof?.filename  ?? "demo-document.pdf",
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error);
      setXrplResult(data);
    } catch (e: any) {
      setXrplError(e.message);
    } finally {
      setXrplLoading(false);
    }
  };

  return (
    <section>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8, marginBottom: 16,
        paddingBottom: 12, borderBottom: "0.5px solid var(--border)",
      }}>
        <span style={{ fontSize: 18, color: "#E84142" }}>◈</span>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Flare Network</span>
        <span style={{
          fontSize: 9, fontWeight: 600, padding: "2px 8px", borderRadius: 20,
          background: "rgba(232,65,66,0.1)", color: "#E84142",
          border: "0.5px solid rgba(232,65,66,0.25)", letterSpacing: "0.5px",
        }}>COSTON2</span>
      </div>

      {/* FTSO Price strip */}
      {pricing && (
        <div style={{
          display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap",
        }}>
          {[
            { label: "XRP/USD",  val: pricing.xrp.usd },
            { label: "HBAR/USD", val: pricing.hbar.usd },
            { label: "Reward",   val: `${pricing.rewardHbar} HBAR ≈ ${pricing.xrpEquivalent} XRP` },
          ].map((item) => (
            <div key={item.label} style={{
              flex: 1, minWidth: 100,
              background: "var(--color-background-secondary)",
              borderRadius: "var(--border-radius-md)", padding: "8px 12px",
            }}>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {item.val}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 1 }}>FTSO v2</div>
            </div>
          ))}
        </div>
      )}

      {/* TEE Attestation */}
      <div style={{
        border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)",
        padding: "16px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: "rgba(123,110,246,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#7B6EF6",
          }}>⬡</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>TEE Extension — Attested Proof</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              A Flare Trusted Execution Environment independently fetches your HCS proof from Mirror Node,
              verifies the document hash matches, and returns a signed attestation — a second,
              hardware-attested layer of verification.
            </div>
          </div>
        </div>

        {!lastProof ? (
          <div style={{ fontSize: 12, color: "var(--text-secondary)", padding: "10px 0", fontStyle: "italic" }}>
            Submit a document above first, then request TEE attestation.
          </div>
        ) : (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>Attesting proof:</div>
            <code style={{
              fontSize: 10, color: "var(--text-primary)", fontFamily: "var(--font-mono)",
              background: "var(--color-background-secondary)", padding: "4px 8px",
              borderRadius: 4, display: "block", wordBreak: "break-all",
            }}>
              {lastProof.docHash.slice(0, 32)}… · seq #{lastProof.hcsSequenceNumber}
            </code>
          </div>
        )}

        <button
          style={{
            padding: "8px 16px", borderRadius: 8,
            background: lastProof ? "#7B6EF6" : "var(--color-background-secondary)",
            border: "none", color: lastProof ? "#fff" : "var(--text-secondary)",
            fontSize: 13, fontWeight: 500, cursor: lastProof ? "pointer" : "not-allowed",
            opacity: attestLoading ? 0.6 : 1, transition: "opacity 0.15s",
          }}
          disabled={!lastProof || attestLoading}
          onClick={requestAttestation}
        >
          {attestLoading
            ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Spinner /> Requesting TEE attestation…
              </span>
            : "Request TEE attestation ⬡"}
        </button>

        {attestError && <ErrorBox msg={attestError} />}

        {attestResult && (
          <div style={{
            marginTop: 12, border: "0.5px solid rgba(123,110,246,0.3)",
            borderRadius: 8, overflow: "hidden",
            animation: "slideUp .3s ease forwards",
          }}>
            <div style={{
              background: "rgba(123,110,246,0.06)", padding: "8px 12px",
              borderBottom: "0.5px solid rgba(123,110,246,0.1)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ color: attestResult.attested ? "#0ABFA3" : "#F4A72A", fontSize: 14 }}>
                {attestResult.attested ? "✅" : "⏳"}
              </span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                {attestResult.attested ? "Attestation verified" : "Attestation pending"}
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 20,
                background: "rgba(123,110,246,0.1)", color: "#7B6EF6",
              }}>TEE SIGNED</span>
            </div>
            <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7 }}>
              <Row label="Statement"  value={attestResult.statement} />
              <Row label="TEE sig"    value={`${attestResult.teeSignature.slice(0, 32)}…`} mono />
              <Row label="TEE pubkey" value={`${attestResult.teePublicKey.slice(0, 32)}…`} mono />
              <Row label="Attested"   value={attestResult.attestedAt} />
              {attestResult.consensusTimestamp && (
                <Row label="Consensus" value={attestResult.consensusTimestamp} mono />
              )}
              <a href={attestResult.verificationUrl} target="_blank" rel="noopener noreferrer"
                style={{ color: "#7B6EF6", fontSize: 11, marginTop: 4, display: "inline-block" }}>
                Verify on Mirror Node ↗
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Flare Smart Account / XRPL Pay-to-Prove */}
      <div style={{
        border: "0.5px solid var(--color-border-tertiary)", borderRadius: "var(--border-radius-lg)",
        padding: "16px",
      }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 12 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: "rgba(232,65,66,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, color: "#E84142",
          }}>◈</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>Smart Account — Pay-to-Prove from XRPL</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5 }}>
              XRPL users send a payment with a document hash in the memo field.
              The Flare Smart Account detects it via the FDC bridge and triggers the full
              ProvenanceChain pipeline — no EVM wallet required.
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              XRPL sender address
            </label>
            <input
              value={xrplSender}
              onChange={(e) => setXrplSender(e.target.value)}
              style={{
                width: "100%", padding: "7px 10px", fontSize: 12,
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: 6, color: "var(--text-primary)", fontFamily: "var(--font-mono)",
              }}
              placeholder="rHb9CJAWyB4rj91VRWn96DkukG4bwdtyTh"
            />
          </div>
          <div>
            <label style={{ fontSize: 11, color: "var(--text-secondary)", display: "block", marginBottom: 4 }}>
              Amount (XRP)
              {pricing && (
                <span style={{ color: "var(--text-secondary)", marginLeft: 6 }}>
                  — min {pricing.xrpEquivalent} XRP (FTSO-priced)
                </span>
              )}
            </label>
            <input
              value={xrplAmount}
              onChange={(e) => setXrplAmount(e.target.value)}
              type="number" min="0.01" step="0.01"
              style={{
                width: 120, padding: "7px 10px", fontSize: 12,
                background: "var(--color-background-secondary)",
                border: "0.5px solid var(--color-border-secondary)",
                borderRadius: 6, color: "var(--text-primary)",
              }}
            />
          </div>
        </div>

        <button
          style={{
            padding: "8px 16px", borderRadius: 8,
            background: "#E84142", border: "none", color: "#fff",
            fontSize: 13, fontWeight: 500, cursor: "pointer",
            opacity: xrplLoading ? 0.6 : 1, transition: "opacity 0.15s",
          }}
          disabled={xrplLoading}
          onClick={triggerXRPL}
        >
          {xrplLoading
            ? <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <Spinner /> Triggering Smart Account…
              </span>
            : "Simulate XRPL Pay-to-Prove ◈"}
        </button>

        {xrplError && <ErrorBox msg={xrplError} />}

        {xrplResult && (
          <div style={{
            marginTop: 12, border: "0.5px solid rgba(232,65,66,0.3)",
            borderRadius: 8, overflow: "hidden",
            animation: "slideUp .3s ease forwards",
          }}>
            <div style={{
              background: "rgba(232,65,66,0.06)", padding: "8px 12px",
              borderBottom: "0.5px solid rgba(232,65,66,0.1)",
              display: "flex", alignItems: "center", gap: 6,
            }}>
              <span style={{ color: "#0ABFA3", fontSize: 14 }}>✅</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)" }}>
                Smart Account triggered
              </span>
              <span style={{
                marginLeft: "auto", fontSize: 10, padding: "2px 8px", borderRadius: 20,
                background: "rgba(232,65,66,0.1)", color: "#E84142",
              }}>
                {xrplResult.smartAccount.mode === "live" ? "ON-CHAIN" : "SIMULATION"}
              </span>
            </div>
            <div style={{ padding: "10px 12px", fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.8 }}>
              <Row label="XRPL sender" value={xrplResult.smartAccount.xrplSender} mono />
              <Row label="Doc hash"   value={`${xrplResult.smartAccount.docHash.slice(0,20)}…`} mono />
              <Row label="Amount"     value={`${xrplResult.smartAccount.amountXRP} XRP`} />
              {xrplResult.smartAccount.transactionHash && (
                <Row label="Flare tx"  value={`${xrplResult.smartAccount.transactionHash.slice(0,20)}…`} mono />
              )}

              <div style={{ marginTop: 10, borderTop: "0.5px solid var(--color-border-tertiary)", paddingTop: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 500, marginBottom: 6, color: "var(--text-primary)" }}>
                  XRPL payment instructions
                </div>
                <Row label="Destination" value={xrplResult.xrplInstructions.destinationAddress} mono />
                <Row label="Min XRP"     value={`${xrplResult.xrplInstructions.minimumXRP} XRP`} />
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 3 }}>Memo (include in your XRPL tx)</div>
                  <code style={{
                    fontSize: 9, background: "var(--color-background-secondary)", padding: "5px 8px",
                    borderRadius: 4, display: "block", wordBreak: "break-all",
                    color: "var(--text-primary)", fontFamily: "var(--font-mono)",
                  }}>
                    {xrplResult.xrplInstructions.memoHex.slice(0, 60)}…
                  </code>
                </div>
              </div>

              {xrplResult.smartAccount.calldata && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 3 }}>
                    Smart Account calldata (handleXRPLPayment)
                  </div>
                  <code style={{
                    fontSize: 9, background: "var(--color-background-secondary)", padding: "5px 8px",
                    borderRadius: 4, display: "block", wordBreak: "break-all",
                    color: "var(--text-primary)", fontFamily: "var(--font-mono)",
                  }}>
                    {xrplResult.smartAccount.calldata.slice(0, 80)}…
                  </code>
                </div>
              )}

              {xrplResult.smartAccount.explorerUrl && (
                <a href={xrplResult.smartAccount.explorerUrl} target="_blank" rel="noopener noreferrer"
                  style={{ color: "#E84142", fontSize: 11, marginTop: 6, display: "inline-block" }}>
                  View on FlareScan ↗
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function Spinner() {
  return (
    <span style={{
      display: "inline-block", width: 12, height: 12,
      border: "1.5px solid rgba(255,255,255,0.3)",
      borderTopColor: "#fff", borderRadius: "50%",
      animation: "spin .7s linear infinite", flexShrink: 0,
    }} />
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div style={{
      marginTop: 10, padding: "8px 12px", borderRadius: 6,
      background: "rgba(240,101,67,0.08)", border: "0.5px solid rgba(240,101,67,0.3)",
      color: "#F06543", fontSize: 12,
    }}>
      {msg}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 2 }}>
      <span style={{ color: "var(--text-secondary)", minWidth: 80, flexShrink: 0, fontSize: 11 }}>{label}</span>
      <span style={{
        fontFamily: mono ? "var(--font-mono)" : "inherit",
        fontSize: mono ? 10 : 11,
        color: "var(--text-primary)", wordBreak: "break-all",
      }}>
        {value}
      </span>
    </div>
  );
}
