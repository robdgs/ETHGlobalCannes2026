"use client";
/**
 * app/gate/page.tsx
 *
 * World ID 4.0 proof-of-human gate.
 *
 * Flow (per official docs at https://docs.world.org/world-id/idkit/integrate):
 *  1. POST /api/world/signature → { app_id, rp_id, sig, nonce, created_at, expires_at }
 *  2. IDKit.request({ app_id, action, rp_context }).preset(orbLegacy())
 *  3. Show request.connectorURI as QR code
 *  4. request.pollUntilCompletion()
 *  5. POST /api/world/verify  → sets httpOnly cookie
 *  6. router.replace(nextPath)
 *
 * Signal: wallet address (if connected) binds the proof to the EVM wallet.
 *
 * Testing: set NEXT_PUBLIC_WORLD_ENV=staging and use https://simulator.worldcoin.org
 */
import { useState, useCallback, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";

const ACTION = process.env.NEXT_PUBLIC_WORLD_ACTION ?? "notarize-document";
const ENV = (process.env.NEXT_PUBLIC_WORLD_ENV ?? "staging") as
  | "staging"
  | "production";
const IS_DEV =
  !process.env.NEXT_PUBLIC_WORLD_APP_ID && typeof window !== "undefined";

type Step =
  | "idle"
  | "loading"
  | "qr"
  | "polling"
  | "verifying"
  | "done"
  | "error";

function GateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") ?? "/";

  const [step, setStep] = useState<Step>("idle");
  const [qrUrl, setQrUrl] = useState("");
  const [link, setLink] = useState("");
  const [error, setError] = useState("");

  // Dev bypass: no credentials → auto-verify and continue
  useEffect(() => {
    if (!IS_DEV) return;
    fetch("/api/world/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idkitResponse: { dev: true } }),
    }).then(() => router.replace(nextPath));
  }, [nextPath, router]);

  const verify = useCallback(async () => {
    setStep("loading");
    setError("");

    try {
      // Step 1: get RP signature + app_id + rp_id from backend
      const sigRes = await fetch("/api/world/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: ACTION }),
      });
      if (!sigRes.ok) throw new Error("Failed to get RP signature");
      const rpData = await sigRes.json();

      // Step 2: build IDKit request (dynamic import avoids SSR crypto issues)
      const { IDKit, orbLegacy } = await import("@worldcoin/idkit-core");

      const request = await IDKit.request({
        app_id: rpData.app_id,
        action: ACTION,
        rp_context: {
          rp_id: rpData.rp_id,
          nonce: rpData.nonce,
          created_at: rpData.created_at, // Unix timestamp (number)
          expires_at: rpData.expires_at, // Unix timestamp (number)
          signature: rpData.sig,
        },
        allow_legacy_proofs: true,
        environment: ENV,
      }).preset(
        // Optional signal: bind proof to wallet address if connected
        orbLegacy(),
      );

      // Step 3: show QR code
      const uri = request.connectorURI;
      if (uri) {
        setQrUrl(
          `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&color=ffffff&bgcolor=000000&data=${encodeURIComponent(
            uri,
          )}`,
        );
        setLink(uri);
      }
      setStep("qr");

      // Step 4: poll until the user completes verification
      setStep("polling");
      const completion = await request.pollUntilCompletion({
        pollInterval: 2_000,
        timeout: 120_000,
      });

      if (!completion.success) {
        throw new Error(
          String(completion.error) === "Timeout"
            ? "Verification timed out. Please try again."
            : "Verification cancelled.",
        );
      }

      // Step 5: send proof to backend
      setStep("verifying");
      const verifyRes = await fetch("/api/world/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idkitResponse: completion }),
      });
      const result = await verifyRes.json();
      if (!verifyRes.ok || result.error)
        throw new Error(result.error ?? "Verification failed");

      // Step 6: done — enter the app
      setStep("done");
      await new Promise((r) => setTimeout(r, 700));
      router.replace(nextPath);
    } catch (err: any) {
      setError(err.message ?? "Something went wrong. Please try again.");
      setStep("error");
    }
  }, [nextPath, router]);

  if (IS_DEV) {
    return (
      <div style={s.center}>
        <Spinner />
        <p style={{ color: "#555", fontSize: 13, marginTop: 14 }}>
          World ID not configured — bypassing in dev mode…
        </p>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <div style={s.grid} aria-hidden />

      <div style={s.card}>
        {/* Orb graphic */}
        <div style={s.orbWrap}>
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <circle
              cx="32"
              cy="32"
              r="31"
              stroke="rgba(255,255,255,0.08)"
              strokeWidth="1"
            />
            <circle
              cx="32"
              cy="32"
              r="22"
              stroke="rgba(255,255,255,0.12)"
              strokeWidth="1"
            />
            <circle
              cx="32"
              cy="32"
              r="13"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="1.5"
              fill="rgba(255,255,255,0.04)"
            />
            <circle cx="32" cy="32" r="5" fill="white" opacity="0.9" />
            <circle cx="27" cy="27" r="2" fill="white" opacity="0.35" />
          </svg>
        </div>

        <h1 style={s.h1}>
          Proof of Human
          <br />
          <span style={s.h1dim}>Required</span>
        </h1>

        <p style={s.sub}>
          A notary is, by definition, a human being. Before you can certify that
          a document existed, prove that <em>you</em> do.
        </p>

        <div style={s.rule} />

        {/* Features */}
        <div style={s.features}>
          {[
            {
              icon: "◎",
              title: "One person, one notary",
              desc: "Each human gets access once. Bots and duplicates cannot.",
            },
            {
              icon: "⊘",
              title: "Zero data shared",
              desc: "We receive a ZK proof — not your identity or biometrics.",
            },
            {
              icon: "↺",
              title: "Reusable credential",
              desc: "Verify once with World ID. Works across apps.",
            },
          ].map((f) => (
            <div key={f.icon} style={s.feat}>
              <span style={s.featIcon}>{f.icon}</span>
              <div>
                <div style={s.featTitle}>{f.title}</div>
                <div style={s.featDesc}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Action area */}
        <div style={s.action}>
          {/* QR code */}
          {(step === "qr" || step === "polling") && qrUrl && (
            <div style={s.qrBox}>
              <div style={s.qrLabel}>
                {step === "polling"
                  ? "Waiting for World App…"
                  : "Scan with World App"}
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrUrl}
                alt="World ID QR code"
                width={200}
                height={200}
                style={{ display: "block", margin: "0 auto", borderRadius: 8 }}
              />
              {link && (
                <a
                  href={link}
                  style={s.deepLink}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open in World App ↗
                </a>
              )}
              {step === "polling" && (
                <div style={s.pollRow}>
                  <Spinner />{" "}
                  <span style={{ color: "#555", fontSize: 12 }}>
                    Waiting for confirmation…
                  </span>
                </div>
              )}
            </div>
          )}

          {/* States */}
          {step === "loading" && (
            <StatusRow>
              <Spinner />
              <span>Preparing verification…</span>
            </StatusRow>
          )}
          {step === "verifying" && (
            <StatusRow>
              <Spinner />
              <span>Verifying proof…</span>
            </StatusRow>
          )}
          {step === "done" && (
            <StatusRow color="#4ade80">
              <CheckIcon />
              <span>Verified — entering ProvenanceChain…</span>
            </StatusRow>
          )}
          {step === "error" && error && <div style={s.errBox}>⚠ {error}</div>}

          {/* CTA */}
          {(step === "idle" || step === "error") && (
            <button onClick={verify} style={s.btn}>
              <OrbIcon />
              {step === "error" ? "Try again" : "Verify with World ID"}
            </button>
          )}
        </div>

        {/* Footer */}
        <p style={s.foot}>
          Powered by{" "}
          <a
            href="https://world.org"
            target="_blank"
            rel="noreferrer"
            style={s.footLink}
          >
            World ID
          </a>{" "}
          · Zero-knowledge proof of humanity
          {ENV === "staging" && (
            <>
              {" "}
              ·{" "}
              <a
                href="https://simulator.worldcoin.org"
                target="_blank"
                rel="noreferrer"
                style={s.footLink}
              >
                Use simulator ↗
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <Suspense>
      <GateContent />
    </Suspense>
  );
}

// ── Micro-components ──────────────────────────────────────────────────────────

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 15,
        height: 15,
        flexShrink: 0,
        border: "2px solid rgba(255,255,255,0.1)",
        borderTopColor: "rgba(255,255,255,0.5)",
        borderRadius: "50%",
        animation: "spin 0.7s linear infinite",
      }}
    />
  );
}

function CheckIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 18 18"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="9" cy="9" r="8" stroke="#4ade80" strokeWidth="1.4" />
      <path
        d="M5.5 9l2.5 2.5 4.5-4.5"
        stroke="#4ade80"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function OrbIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      style={{ flexShrink: 0 }}
    >
      <circle cx="8" cy="8" r="7" stroke="#0a0a0b" strokeWidth="1.2" />
      <circle cx="8" cy="8" r="3" fill="#0a0a0b" opacity="0.7" />
      <circle cx="6.5" cy="6.5" r="1" fill="#0a0a0b" opacity="0.35" />
    </svg>
  );
}

function StatusRow({
  children,
  color,
}: {
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        color: color ?? "#888",
        fontSize: 13,
        padding: "10px 0",
      }}
    >
      {children}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "#0a0a0b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "24px 16px",
    position: "relative",
    overflow: "hidden",
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  grid: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
    backgroundImage: `linear-gradient(rgba(255,255,255,0.025) 1px,transparent 1px),
                      linear-gradient(90deg,rgba(255,255,255,0.025) 1px,transparent 1px)`,
    backgroundSize: "48px 48px",
  },
  card: {
    position: "relative",
    zIndex: 1,
    maxWidth: 460,
    width: "100%",
    background: "rgba(255,255,255,0.03)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: "40px 44px",
    backdropFilter: "blur(20px)",
    boxShadow:
      "0 32px 64px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)",
  },
  orbWrap: { marginBottom: 22, display: "flex", justifyContent: "center" },
  h1: {
    fontSize: "clamp(22px,4vw,30px)",
    fontWeight: 700,
    color: "#fff",
    textAlign: "center",
    lineHeight: 1.2,
    marginBottom: 12,
    letterSpacing: "-0.4px",
  },
  h1dim: { color: "rgba(255,255,255,0.3)" },
  sub: {
    fontSize: 13.5,
    color: "rgba(255,255,255,0.4)",
    textAlign: "center",
    lineHeight: 1.75,
    marginBottom: 0,
  },
  rule: { height: 1, background: "rgba(255,255,255,0.07)", margin: "24px 0" },
  features: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginBottom: 28,
  },
  feat: { display: "flex", alignItems: "flex-start", gap: 13 },
  featIcon: {
    fontSize: 16,
    color: "rgba(255,255,255,0.4)",
    width: 20,
    textAlign: "center",
    flexShrink: 0,
    marginTop: 1,
  },
  featTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "rgba(255,255,255,0.75)",
    marginBottom: 2,
  },
  featDesc: { fontSize: 12, color: "rgba(255,255,255,0.3)", lineHeight: 1.5 },
  action: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    alignItems: "center",
  },
  btn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    width: "100%",
    padding: "13px 20px",
    background: "#fff",
    color: "#0a0a0b",
    border: "none",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    letterSpacing: "-0.2px",
    transition: "opacity 0.15s",
  },
  qrBox: {
    width: "100%",
    background: "#000",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: 12,
    padding: "20px 16px",
    textAlign: "center",
  },
  qrLabel: {
    fontSize: 11,
    color: "rgba(255,255,255,0.3)",
    marginBottom: 14,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  deepLink: {
    display: "block",
    marginTop: 12,
    fontSize: 12,
    color: "rgba(255,255,255,0.25)",
    textDecoration: "none",
  },
  pollRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
  },
  errBox: {
    width: "100%",
    padding: "12px 16px",
    textAlign: "center",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 8,
    color: "#f87171",
    fontSize: 13,
    lineHeight: 1.5,
  },
  foot: {
    marginTop: 22,
    fontSize: 11,
    color: "rgba(255,255,255,0.18)",
    textAlign: "center",
    lineHeight: 1.6,
  },
  footLink: { color: "rgba(255,255,255,0.28)", textDecoration: "none" },
  center: {
    minHeight: "100vh",
    background: "#0a0a0b",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "column",
  },
};
