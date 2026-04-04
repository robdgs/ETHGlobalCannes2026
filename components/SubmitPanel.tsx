"use client";

import { useState, useRef, useCallback } from "react";
import type { SubmitResult } from "@/lib/types";

const EXPLORER_LABELS: Record<string, string> = {
  hcsTopic: "HCS topic",
  nftToken: "NFT collection",
  hcsTx:    "HCS transaction",
  nftTx:    "NFT transaction",
  schedule: "Scheduled Tx",
};

type Step = "idle" | "hashing" | "hcs" | "nft" | "schedule" | "done" | "error";

const STEP_LABELS: Record<Step, string> = {
  idle:     "Stamp proof on Hedera",
  hashing:  "Hashing file…",
  hcs:      "Publishing to HCS…",
  nft:      "Minting proof NFT…",
  schedule: "Scheduling reward…",
  done:     "Proof stamped ✓",
  error:    "Retry",
};

const PROGRESS: Record<Step, number> = {
  idle: 0, hashing: 15, hcs: 40, nft: 70, schedule: 90, done: 100, error: 0,
};

interface Props {
  onSubmitted: (result?: import("@/lib/types").SubmitResult) => void;
}

export default function SubmitPanel({ onSubmitted }: Props) {
  const [file, setFile]           = useState<File | null>(null);
  const [text, setText]           = useState("");
  const [submitter, setSubmitter] = useState("");
  const [step, setStep]           = useState<Step>("idle");
  const [result, setResult]       = useState<SubmitResult | null>(null);
  const [error, setError]         = useState("");
  const [dragging, setDragging]   = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    setFile(f);
    setText("");
    setResult(null);
    setError("");
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, []);

  const submit = async () => {
    if (!file && !text.trim()) {
      setError("Drop a file or paste text to submit.");
      return;
    }
    setError("");
    setResult(null);

    try {
      const fd = new FormData();
      if (file) {
        setStep("hashing");
        // Hash client-side
        const buf  = await file.arrayBuffer();
        const hash = await crypto.subtle.digest("SHA-256", buf);
        const hex  = Array.from(new Uint8Array(hash))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
        // Still send the file so the server can re-hash to verify; or send hash only
        fd.append("file", file);
      } else {
        fd.append("text", text.trim());
      }
      if (submitter.trim()) fd.append("submitter", submitter.trim());

      setStep("hcs");
      const res  = await fetch("/api/submit", { method: "POST", body: fd });

      setStep("nft");
      const data = await res.json();

      if (!res.ok || data.error) throw new Error(data.error ?? "Submission failed.");

      setStep("schedule");
      await new Promise((r) => setTimeout(r, 400)); // visual beat

      setStep("done");
      setResult(data);
      onSubmitted(data);
    } catch (e: any) {
      setStep("error");
      setError(e.message);
    }
  };

  const reset = () => {
    setStep("idle");
    setFile(null);
    setText("");
    setResult(null);
    setError("");
  };

  const busy = step !== "idle" && step !== "done" && step !== "error";
  const progress = PROGRESS[step];

  return (
    <section className="card" style={{ marginBottom: 16 }}>
      <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>Submit a document</h2>
      <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.5 }}>
        Hash locally → stamp on HCS → mint proof NFT → schedule reward. The file never leaves your device.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => !busy && fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1.5px dashed ${dragging ? "var(--hedera-purple)" : file ? "var(--hedera-teal)" : "var(--border-md)"}`,
          borderRadius: 10,
          padding: "24px 20px",
          textAlign: "center",
          cursor: busy ? "not-allowed" : "pointer",
          background: dragging
            ? "rgba(123,110,246,0.05)"
            : file
            ? "rgba(10,191,163,0.05)"
            : "transparent",
          transition: "all 0.15s",
          marginBottom: 12,
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 6 }}>
          {file ? "✓" : "⬆"}
        </div>
        <div style={{ fontSize: 13, color: file ? "var(--hedera-teal)" : "var(--text-secondary)", fontWeight: file ? 500 : 400 }}>
          {file
            ? `${file.name} (${formatBytes(file.size)})`
            : "Drop a file or click to browse"}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          hidden
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
        />
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, margin: "14px 0", color: "var(--text-faint)", fontSize: 12 }}>
        <div style={{ flex: 1, height: 0.5, background: "var(--border)" }} />
        or paste text
        <div style={{ flex: 1, height: 0.5, background: "var(--border)" }} />
      </div>

      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setFile(null); }}
        disabled={busy}
        rows={3}
        placeholder="Paste text to prove its existence at a point in time…"
        className="input-field"
        style={{ resize: "vertical", marginBottom: 12, fontFamily: "inherit" }}
      />

      <div style={{ marginBottom: 16 }}>
        <label className="field-label">Your Hedera account (optional)</label>
        <input
          type="text"
          value={submitter}
          onChange={(e) => setSubmitter(e.target.value)}
          disabled={busy}
          placeholder="0.0.12345 — to receive proof NFT + reward"
          className="input-field"
        />
      </div>

      {/* Submit button */}
      <button
        className="btn-primary"
        onClick={step === "done" ? reset : submit}
        disabled={busy}
      >
        {STEP_LABELS[step]}
      </button>

      {/* Progress bar */}
      {progress > 0 && (
        <div style={{ height: 3, background: "var(--border)", borderRadius: 2, marginTop: 12, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${progress}%`,
              background: step === "done" ? "var(--hedera-teal)" : "var(--hedera-purple)",
              borderRadius: 2,
              transition: "width 0.5s ease, background 0.3s",
            }}
          />
        </div>
      )}

      {/* Step indicator */}
      {busy && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: "var(--text-secondary)" }}>
          <span className="spinner" />
          {STEP_LABELS[step]}
        </div>
      )}

      {/* Error */}
      {error && (
        <div
          className="animate-slide-up"
          style={{
            marginTop: 12,
            padding: "10px 14px",
            background: "rgba(240,101,67,0.08)",
            border: "0.5px solid rgba(240,101,67,0.3)",
            borderRadius: 8,
            color: "var(--hedera-coral)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className="animate-slide-up"
          style={{
            marginTop: 16,
            border: "0.5px solid rgba(10,191,163,0.3)",
            borderRadius: 10,
            overflow: "hidden",
          }}
        >
          {/* Hash line */}
          <div
            style={{
              background: "rgba(10,191,163,0.06)",
              padding: "10px 14px",
              fontFamily: "var(--font-geist-mono)",
              fontSize: 10,
              color: "var(--hedera-teal)",
              wordBreak: "break-all",
              borderBottom: "0.5px solid var(--border)",
            }}
          >
            SHA-256  {result.docHash}
          </div>

          {/* Steps */}
          <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            <ResultStep
              badge="HCS"
              badgeClass="badge-teal"
              label={`Consensus sequence #${result.hcs.sequenceNumber} · Topic ${result.hcs.topicId}`}
              detail={result.hcs.transactionId}
            />
            <ResultStep
              badge="NFT"
              badgeClass="badge-coral"
              label={`Proof token serial #${result.hts.serialNumber} · ${result.hts.tokenId}`}
              detail={result.hts.transactionId}
            />
            {result.schedule && (
              <ResultStep
                badge="SCHED"
                badgeClass="badge-amber"
                label={`Reward scheduled — ${(result.schedule.rewardTinybars / 1e8).toFixed(4)} HBAR`}
                detail={result.schedule.scheduleId ?? result.schedule.transactionId}
              />
            )}
          </div>

          {/* Explorer links */}
          <div
            style={{
              borderTop: "0.5px solid var(--border)",
              padding: "10px 14px",
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
            }}
          >
            {Object.entries(result.explorerLinks).map(([key, url]) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: 11,
                  textDecoration: "none",
                  padding: "3px 10px",
                  borderRadius: 20,
                  border: "0.5px solid var(--border-md)",
                  color: "var(--hedera-purple)",
                  transition: "background 0.15s",
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = "var(--accent-purple)")}
                onMouseOut={(e)  => (e.currentTarget.style.background = "transparent")}
              >
                {EXPLORER_LABELS[key] ?? key} ↗
              </a>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ResultStep({
  badge, badgeClass, label, detail,
}: {
  badge: string; badgeClass: string; label: string; detail: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
      <span className={`badge ${badgeClass}`} style={{ marginTop: 1, flexShrink: 0 }}>{badge}</span>
      <div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.4 }}>{label}</div>
        <div style={{
          fontFamily: "var(--font-geist-mono)",
          fontSize: 10,
          color: "var(--text-faint)",
          wordBreak: "break-all",
          marginTop: 2,
        }}>
          {detail}
        </div>
      </div>
    </div>
  );
}

function formatBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}
