"use client";
/**
 * app/login/page.tsx
 *
 * ProvenanceChain — World ID login page.
 * After verifying, redirects to the main dashboard.
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import WorldIDButton from "@/components/WorldIDButton";

interface VerificationResult {
  verified: boolean;
  nullifier_hash?: string;
  session_id?: string;
  [key: string]: unknown;
}

export default function LoginPage() {
  const router  = useRouter();
  const [result, setResult]   = useState<VerificationResult | null>(null);
  const [error,  setError]    = useState("");

  function handleVerified(data: VerificationResult) {
    setResult(data);
    // In production you'd set a cookie/session here, then redirect.
    // For now we redirect after a short celebration beat.
    setTimeout(() => router.push("/"), 2200);
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "var(--sans)",
    }}>

      {/* Top bar */}
      <header style={{
        background: "#fff",
        borderBottom: "0.5px solid var(--bd)",
        padding: "0 28px",
        height: 56,
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}>
        <div style={{
          width: 34, height: 34, borderRadius: 8,
          background: "var(--p-lt)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#534AB7" strokeWidth="1.5" fill="none"/>
            <circle cx="9" cy="9" r="2.5" fill="#534AB7"/>
          </svg>
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--t0)", letterSpacing: "-0.2px" }}>
          ProvenanceChain
        </span>
      </header>

      {/* Main content */}
      <main style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}>
        <div style={{
          width: "100%",
          maxWidth: 420,
          display: "flex",
          flexDirection: "column",
          gap: 0,
        }}>

          {/* Card */}
          <div style={{
            background: "#fff",
            border: "0.5px solid var(--bd)",
            borderRadius: "var(--r-lg)",
            overflow: "hidden",
          }}>

            {/* Card header */}
            <div style={{
              padding: "32px 36px 24px",
              borderBottom: "0.5px solid var(--bd)",
              background: "linear-gradient(135deg, var(--p-lt) 0%, #fff 60%)",
            }}>
              {/* World orb illustration */}
              <div style={{
                width: 72, height: 72,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 60%, #0f3460 100%)",
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: "0 8px 28px rgba(0,0,0,0.25)",
                margin: "0 auto 20px",
                position: "relative",
              }}>
                <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                  <circle cx="18" cy="18" r="16" stroke="white" strokeWidth="1.5" />
                  <circle cx="18" cy="18" r="9" fill="white" fillOpacity="0.2" />
                  <circle cx="18" cy="18" r="4" fill="white" fillOpacity="0.9" />
                </svg>
                {/* Glow ring */}
                <div style={{
                  position: "absolute", inset: -3,
                  borderRadius: "50%",
                  background: "conic-gradient(from 0deg, #534ab7, #7f77dd, #1d9e75, #534ab7)",
                  zIndex: -1,
                  opacity: 0.6,
                }} />
              </div>

              <h1 style={{
                fontSize: 22, fontWeight: 700,
                color: "var(--t0)", textAlign: "center",
                letterSpacing: "-0.4px", marginBottom: 8,
              }}>
                Prove you're human
              </h1>
              <p style={{
                fontSize: 14, color: "var(--t2)",
                textAlign: "center", lineHeight: 1.65,
              }}>
                ProvenanceChain uses <b style={{ color: "var(--t1)" }}>World ID</b> to ensure
                each certificate is issued by a unique, verified person —
                not a bot or script.
              </p>
            </div>

            {/* Card body */}
            <div style={{ padding: "28px 36px" }}>

              {result ? (
                /* ── Success state ── */
                <div style={{ textAlign: "center" }} className="fadein">
                  <div style={{
                    width: 56, height: 56,
                    borderRadius: "50%",
                    background: "var(--teal-lt)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    margin: "0 auto 16px",
                    fontSize: 24,
                  }}>
                    ✓
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: "var(--teal-dk)", marginBottom: 6 }}>
                    Identity verified
                  </div>
                  <div style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.6, marginBottom: 16 }}>
                    You're confirmed as a unique human.
                    <br />Redirecting to the dashboard…
                  </div>

                  {result.nullifier_hash && (
                    <div style={{
                      fontFamily: "var(--mono)", fontSize: 10,
                      color: "var(--t3)", wordBreak: "break-all",
                      background: "var(--bg2)", padding: "8px 12px", borderRadius: 8,
                    }}>
                      {result.nullifier_hash}
                    </div>
                  )}
                </div>
              ) : (
                /* ── Verify state ── */
                <div>
                  <div style={{
                    display: "flex", flexDirection: "column", gap: 12, marginBottom: 24,
                  }}>
                    {[
                      { icon: "🔒", text: "Zero personal data collected — only a cryptographic proof" },
                      { icon: "👤", text: "One certificate slot per unique human, preventing sybil abuse" },
                      { icon: "⛓",  text: "Proof recorded permanently on Hedera alongside your document hash" },
                    ].map(({ icon, text }) => (
                      <div key={text} style={{
                        display: "flex", gap: 10, alignItems: "flex-start",
                      }}>
                        <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{icon}</span>
                        <span style={{ fontSize: 13, color: "var(--t2)", lineHeight: 1.55 }}>{text}</span>
                      </div>
                    ))}
                  </div>

                  <WorldIDButton
                    action="login"
                    onVerified={handleVerified}
                    onError={setError}
                  />

                  {error && (
                    <div style={{
                      marginTop: 12,
                      padding: "9px 13px",
                      borderRadius: 8,
                      background: "var(--red-lt)",
                      border: "0.5px solid var(--red)",
                      color: "var(--red-dk)",
                      fontSize: 13,
                    }}>
                      ⚠ {error}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Footer note */}
          <div style={{
            textAlign: "center", fontSize: 12, color: "var(--t3)",
            marginTop: 20, lineHeight: 1.7,
          }}>
            Powered by{" "}
            <a
              href="https://worldcoin.org/world-id"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--t2)", fontWeight: 500, textDecoration: "none" }}
            >
              World ID
            </a>
            {" "}· Privacy-first proof of personhood
            <br />
            <a
              href="/"
              style={{ color: "var(--p)", fontWeight: 500, textDecoration: "none", marginTop: 4, display: "inline-block" }}
            >
              ← Back to ProvenanceChain
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}