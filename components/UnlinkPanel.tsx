"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { PrivateSubmitResult } from "@/lib/types";

interface UnlinkStatus {
  live:             boolean;
  chain:            string;
  chainId:          number;
  submissionFeeEth: string;
  mode:             string;
}

export default function UnlinkPanel() {
  const [status, setStatus]     = useState<UnlinkStatus | null>(null);
  const [file, setFile]         = useState<File | null>(null);
  const [text, setText]         = useState("");
  const [chainId, setChainId]   = useState(137);
  const [step, setStep]         = useState<"idle"|"zk"|"hcs"|"tee"|"done"|"error">("idle");
  const [result, setResult]     = useState<PrivateSubmitResult | null>(null);
  const [error, setError]       = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/unlink/status").then(r => r.json()).then(setStatus).catch(() => {});
  }, []);

  const STEP_LABELS = {
    idle:  "submit anonymously via unlink",
    zk:    "generating zk proof…",
    hcs:   "publishing to hedera hcs…",
    tee:   "requesting tee attestation…",
    done:  "proof stamped — identity unknown ✓",
    error: "retry",
  };

  const PROGRESS = { idle:0, zk:25, hcs:60, tee:85, done:100, error:0 };

  const handleFile = (f: File) => { setFile(f); setText(""); setResult(null); setError(""); };
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  const submit = async () => {
    if (!file && !text.trim()) { setError("drop a file or paste text"); return; }
    setError(""); setResult(null);
    try {
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text.trim());
      fd.append("chainId", String(chainId));

      setStep("zk");
      await new Promise(r => setTimeout(r, 900)); // ZK proof generation feel

      setStep("hcs");
      const res  = await fetch("/api/unlink/pay", { method: "POST", body: fd });

      setStep("tee");
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Submission failed");

      await new Promise(r => setTimeout(r, 400));
      setStep("done");
      setResult(data.result);
    } catch (e: any) {
      setStep("error");
      setError(e.message);
    }
  };

  const reset = () => { setStep("idle"); setFile(null); setText(""); setResult(null); setError(""); };
  const busy  = !["idle","done","error"].includes(step);
  const progress = PROGRESS[step];

  const CHAINS = [
    { id:137,   label:"polygon" },
    { id:8453,  label:"base"    },
    { id:42161, label:"arbitrum"},
  ];

  return (
    <div>
      {/* Mode indicator */}
      {status && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12, fontSize:8, color:"var(--t2)", fontFamily:"var(--mono)", letterSpacing:"0.3px" }}>
          <span>$</span>
          <span>unlink --chain={status.chain} --mode={status.mode} --fee={status.submissionFeeEth}_MATIC</span>
        </div>
      )}

      {/* Explainer */}
      <div style={{ fontSize:8, color:"var(--t2)", lineHeight:1.8, marginBottom:12, borderLeft:"2px solid rgba(123,110,246,0.3)", paddingLeft:10, fontFamily:"var(--mono)" }}>
        // zk proof shields your identity<br/>
        // unlink relay submits tx — no sender on-chain<br/>
        // stealth account receives the proof NFT<br/>
        // document hash stays public. you never do.
      </div>

      {/* Chain selector */}
      <div style={{ display:"flex", gap:4, marginBottom:10 }}>
        {CHAINS.map(c => (
          <button key={c.id} onClick={() => setChainId(c.id)} style={{
            padding:"3px 10px", fontFamily:"var(--mono)", fontSize:8,
            background:"transparent", cursor:"pointer", letterSpacing:"0.5px",
            border: chainId === c.id ? "1px solid var(--p)" : "var(--border)",
            color:  chainId === c.id ? "var(--p)" : "var(--t2)",
            transition:"all 0.1s",
          }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Drop zone */}
      <div
        onClick={() => !busy && fileRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1px solid ${dragging ? "var(--p)" : file ? "var(--teal)" : "var(--t3)"}`,
          padding:"12px 10px", cursor:busy?"not-allowed":"pointer",
          display:"flex", alignItems:"center", gap:10, marginBottom:8,
          background: dragging ? "rgba(123,110,246,0.04)" : file ? "rgba(10,191,163,0.03)" : "transparent",
          transition:"all 0.1s",
        }}
      >
        <span style={{ fontSize:10, color: file ? "var(--teal)" : "var(--t2)" }}>
          {file ? "↑" : "↑"}
        </span>
        <span style={{ fontSize:9, color: file ? "var(--teal)" : "var(--t2)", fontFamily:"var(--mono)", letterSpacing:"0.3px" }}>
          {file ? file.name : "drop file or click to browse"}
        </span>
        <input ref={fileRef} type="file" hidden onChange={e => { if(e.target.files?.[0]) handleFile(e.target.files[0]); }} />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, margin:"6px 0", fontSize:7, color:"var(--t3)", fontFamily:"var(--mono)", letterSpacing:"0.5px" }}>
        <div style={{ flex:1, height:1, background:"var(--bg2)" }} />
        or paste text
        <div style={{ flex:1, height:1, background:"var(--bg2)" }} />
      </div>

      <textarea
        value={text} onChange={e => { setText(e.target.value); setFile(null); }}
        disabled={busy} rows={2}
        placeholder="// paste text to prove anonymously…"
        style={{ width:"100%", background:"var(--bg1)", border:"var(--border)", color:"var(--t0)", fontFamily:"var(--mono)", fontSize:9, padding:"6px 8px", resize:"none", outline:"none", marginBottom:8, lineHeight:1.6, letterSpacing:"0.3px" }}
      />

      {/* Submit button */}
      <button
        onClick={step==="done" ? reset : submit}
        disabled={busy}
        style={{
          width:"100%", padding:8, background:"transparent",
          border:`1px solid ${step==="done" ? "var(--teal)" : step==="error" ? "var(--fl)" : "var(--p)"}`,
          color: step==="done" ? "var(--teal)" : step==="error" ? "var(--fl)" : "var(--p)",
          fontFamily:"var(--mono)", fontSize:9, cursor:busy?"not-allowed":"pointer",
          letterSpacing:"0.8px", textAlign:"left" as const, display:"flex", alignItems:"center", gap:6,
          opacity: busy ? 0.7 : 1, transition:"all 0.15s",
        }}
      >
        <span style={{ color: step==="done" ? "var(--teal)" : "var(--p)", flexShrink:0 }}>$</span>
        {busy && <Spinner />}
        {STEP_LABELS[step]}
      </button>

      {/* Progress */}
      {progress > 0 && (
        <div style={{ height:1, background:"var(--bg2)", marginTop:6, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${progress}%`, background: step==="done" ? "var(--teal)" : "var(--p)", transition:"width 0.5s ease, background 0.3s" }} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ marginTop:8, fontSize:8, color:"var(--fl)", fontFamily:"var(--mono)", borderLeft:"2px solid var(--fl)", paddingLeft:8 }}>
          error: {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div style={{ marginTop:10, border:"1px solid rgba(123,110,246,0.25)", fontSize:8, fontFamily:"var(--mono)" }}>
          {/* ZK layer */}
          <div style={{ borderBottom:"var(--border)", padding:"6px 10px" }}>
            <div style={{ color:"var(--t2)", marginBottom:4, letterSpacing:"0.5px" }}>[ZK_PROOF]</div>
            <OutLine k="nullifier"  v={result.nullifier.slice(0,20)+"…"}      />
            <OutLine k="relay_tx"   v={result.payment.relayTxHash.slice(0,20)+"…"} />
            <OutLine k="chain"      v={`${result.payment.chainId} (${CHAINS.find(c=>c.id===result.payment.chainId)?.label ?? "polygon"})`} />
            <OutLine k="sender"     v="[SHIELDED — ZK proof]" accent="var(--p)" />
          </div>
          {/* HCS layer */}
          <div style={{ borderBottom:"var(--border)", padding:"6px 10px" }}>
            <div style={{ color:"var(--t2)", marginBottom:4, letterSpacing:"0.5px" }}>[HEDERA_HCS]</div>
            <OutLine k="seq"        v={`#${result.hcs.sequenceNumber}`} accent="var(--teal)" />
            <OutLine k="submitter"  v={result.hcs.stealthSubmitter} />
            <OutLine k="identity"   v="[STEALTH ACCOUNT — not linked to sender]" accent="var(--p)" />
          </div>
          {/* TEE layer */}
          <div style={{ borderBottom:"var(--border)", padding:"6px 10px" }}>
            <div style={{ color:"var(--t2)", marginBottom:4, letterSpacing:"0.5px" }}>[FLARE_TEE]</div>
            <OutLine k="attested"   v={result.tee.attested ? "true" : "false"} accent="var(--teal)" />
            <OutLine k="enclave_saw" v="hash only — never the identity" />
          </div>
          {/* Privacy summary */}
          <div style={{ padding:"6px 10px", background:"rgba(123,110,246,0.04)" }}>
            <div style={{ color:"var(--p)", marginBottom:4, letterSpacing:"0.5px" }}>[PRIVACY_SUMMARY]</div>
            <OutLine k="payment_sender" v="private"  accent="var(--p)" />
            <OutLine k="hcs_submitter"  v="private"  accent="var(--p)" />
            <OutLine k="nft_owner"      v="private"  accent="var(--p)" />
            <OutLine k="document_hash"  v="public ← intentional" accent="var(--teal)" />
          </div>
        </div>
      )}
    </div>
  );
}

function OutLine({ k, v, accent }: { k:string; v:string; accent?:string }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:1 }}>
      <span style={{ color:"var(--t3)", minWidth:80, flexShrink:0 }}>{k}:</span>
      <span style={{ color: accent ?? "var(--t1)", wordBreak:"break-all", fontSize:8 }}>{v}</span>
    </div>
  );
}

function Spinner() {
  return (
    <span style={{ display:"inline-block", width:8, height:8, border:"1px solid rgba(123,110,246,0.3)", borderTopColor:"var(--p)", borderRadius:"50%", animation:"spin .6s linear infinite", flexShrink:0 }} />
  );
}
