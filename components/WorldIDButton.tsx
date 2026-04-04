"use client";
/**
 * components/WorldIDButton.tsx — v4 web flow (QR code)
 *
 * Correct flow for web apps with IDKit v4:
 *  1. Fetch RP signature from /api/world/sign
 *  2. Call IDKit.request({...}).preset(orbLegacy()) from @worldcoin/idkit-core
 *  3. Display request.connectorURI as a QR code (user scans with World App)
 *  4. pollUntilCompletion() resolves when user approves in World App
 *  5. POST result to /api/world/verify → call onVerified()
 */

import { useState } from "react";

interface VerificationResult {
  verified: boolean;
  nullifier_hash?: string;
  session_id?: string;
  [key: string]: unknown;
}

interface Props {
  action?: string;
  signal?: string;
  onVerified?: (result: VerificationResult) => void;
  onError?: (msg: string) => void;
}

type Step = "idle" | "loading" | "qr" | "verifying" | "done" | "error";

const APP_ID = (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "") as `app_${string}`;
const RP_ID = process.env.NEXT_PUBLIC_WORLD_RP_ID ?? "";

export default function WorldIDButton({
  action = "login",
  signal,
  onVerified,
  onError,
}: Props) {
  const [step, setStep] = useState<Step>("idle");
  const [qrUrl, setQrUrl] = useState("");
  const [error, setError] = useState("");

  async function startVerification() {
    setStep("loading");
    setError("");

    try {
      // ── 1. Get RP signature from backend ──────────────────────────
      const signRes = await fetch("/api/world/sign", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const signData = await signRes.json();
      if (!signRes.ok || signData.error)
        throw new Error(signData.error ?? "Failed to generate RP signature");

      const rpContext = {
        rp_id: RP_ID,
        nonce: signData.nonce,
        created_at: signData.created_at,
        expires_at: signData.expires_at,
        signature: signData.sig,
      };

      // ── 2. Build IDKit request (dynamic import — browser only) ────
      const { IDKit, orbLegacy } = await import("@worldcoin/idkit-core");

      const request = await IDKit.request({
        app_id: APP_ID,
        action,
        rp_context: rpContext,
        allow_legacy_proofs: true, // required during v3→v4 migration window
      }).preset(orbLegacy(signal ? { signal } : undefined));

      // ── 3. Show QR code ───────────────────────────────────────────
      setQrUrl(request.connectorURI);
      setStep("qr");

      // ── 4. Poll until user approves in World App ──────────────────
      const completion = await request.pollUntilCompletion({
        timeout: 120_000,
      });

      if (!completion.success)
        throw new Error(
          (completion as any).error ?? "World ID verification failed",
        );

      // ── 5. Verify proof server-side ───────────────────────────────
      setStep("verifying");

      const verifyRes = await fetch("/api/world/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ idkitResponse: completion.result }),
      });
      const verifyData = await verifyRes.json();

      if (!verifyRes.ok || !verifyData.verified) {
        // verifyData.raw contains World's exact error — useful for debugging
        const detail =
          verifyData.raw?.detail ?? verifyData.raw?.code ?? verifyData.error;
        throw new Error(detail ?? "Proof rejected by server");
      }

      setStep("done");
      onVerified?.(verifyData);
    } catch (err: any) {
      const msg = err.message ?? "Verification failed";
      setError(msg);
      onError?.(msg);
      setStep("error");
    }
  }

  // ── Render ──────────────────────────────────────────────────────────

  if (step === "idle" || step === "error") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <button
          onClick={startVerification}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            width: "100%",
            padding: "13px 20px",
            border: "none",
            borderRadius: "var(--r)",
            background: "linear-gradient(135deg,#1a1a2e 0%,#16213e 100%)",
            color: "#fff",
            fontSize: 15,
            fontWeight: 600,
            fontFamily: "var(--sans)",
            cursor: "pointer",
            boxShadow: "0 4px 14px rgba(0,0,0,.22)",
            transition: "opacity 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.85")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" stroke="white" strokeWidth="1.4" />
            <ellipse
              cx="10"
              cy="10"
              rx="4"
              ry="9"
              stroke="white"
              strokeWidth="1.4"
            />
            <line
              x1="1"
              y1="10"
              x2="19"
              y2="10"
              stroke="white"
              strokeWidth="1.4"
            />
          </svg>
          {step === "error" ? "Riprova con World ID" : "Verify with World ID"}
        </button>

        {error && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: 8,
              background: "var(--red-lt)",
              border: "0.5px solid var(--red)",
              color: "var(--red-dk)",
              fontSize: 13,
            }}
          >
            ⚠ {error}
          </div>
        )}
      </div>
    );
  }

  if (step === "loading") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px",
          color: "var(--t2)",
          fontSize: 14,
        }}
      >
        <Spinner color="var(--p)" />
        Generating secure request…
      </div>
    );
  }

  if (step === "qr") {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: "24px 20px",
          border: "0.5px solid var(--bd)",
          borderRadius: "var(--r-lg)",
          background: "#fff",
        }}
      >
        {/* QR code via public API — no extra npm package needed */}
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&margin=8&data=${encodeURIComponent(
            qrUrl,
          )}`}
          alt="World ID QR code"
          width={200}
          height={200}
          style={{ borderRadius: 8, border: "0.5px solid var(--bd)" }}
        />

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "var(--t0)",
              marginBottom: 4,
            }}
          >
            Scan with World App
          </div>
          <div style={{ fontSize: 12, color: "var(--t2)", lineHeight: 1.6 }}>
            Open World App on your phone and scan the QR code to verify your
            identity.
          </div>
        </div>

        {/* Deep link for mobile users */}
        <a
          href={qrUrl}
          style={{
            fontSize: 13,
            color: "var(--p)",
            fontWeight: 500,
            textDecoration: "none",
          }}
        >
          Open in World App →
        </a>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
            color: "var(--t3)",
          }}
        >
          <Spinner color="var(--t3)" size={10} />
          Waiting for approval…
        </div>
      </div>
    );
  }

  if (step === "verifying") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "20px",
          color: "var(--t1)",
          fontSize: 14,
        }}
      >
        <Spinner color="var(--p)" />
        Verifying proof…
      </div>
    );
  }

  if (step === "done") {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: "var(--r)",
          background: "var(--teal-lt)",
          border: "0.5px solid var(--teal)",
          color: "var(--teal-dk)",
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        <span style={{ fontSize: 18 }}>✓</span>
        Verified — unique human confirmed
      </div>
    );
  }

  return null;
}

function Spinner({
  color = "#fff",
  size = 14,
}: {
  color?: string;
  size?: number;
}) {
  return (
    <span
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `2px solid ${color}33`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin .7s linear infinite",
        flexShrink: 0,
      }}
    />
  );
}
