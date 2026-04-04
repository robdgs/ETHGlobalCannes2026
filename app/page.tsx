"use client";
import { useState } from "react";
import TopBar          from "@/components/TopBar";
import SubmitFlow      from "@/components/SubmitFlow";
import HederaDashboard from "@/components/HederaDashboard";
import ConfigWarning   from "@/components/ConfigWarning";

interface ZKEntry { seq:number; hash:string; filename:string; nullifier:string; ts:string; }

export default function HomePage() {
  const [tick,       setTick]       = useState(0);
  const [newZKEntry, setNewZKEntry] = useState<ZKEntry|null>(null);

  function handleProof(r: any) {
    setTick(n => n+1);
    if (r.isPrivate) {
      const now = new Date().toLocaleDateString("en",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
      setNewZKEntry({ seq:r.seq, hash:r.docHash, filename:r.filename, nullifier:r.paymentTxHash??"", ts:now });
    }
  }

  return (
    <div style={{ minHeight:"100vh", background:"var(--bg)", fontFamily:"var(--sans)" }}>
      <TopBar />
      <ConfigWarning />

      <main style={{ maxWidth:1100, margin:"0 auto", padding:"28px 20px" }}>

        {/* Hero */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:7, background:"var(--p-lt)", borderRadius:20, padding:"5px 14px", fontSize:12, color:"var(--p-dk)", fontWeight:500, marginBottom:14 }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background:"var(--p)" }} />
            The world's first on-chain notary
          </div>
          <h1 style={{ fontSize:"clamp(22px,4vw,34px)", fontWeight:600, color:"var(--t0)", letterSpacing:"-0.5px", lineHeight:1.2, marginBottom:10 }}>
            Your document, <span style={{ color:"var(--p)" }}>certified forever.</span>
          </h1>
          <p style={{ fontSize:15, color:"var(--t2)", lineHeight:1.7, maxWidth:560, margin:"0 auto 20px" }}>
            Upload any file or paste any text. We compute its fingerprint, record it permanently on Hedera's public blockchain, and issue you a certificate.
            <br /><b style={{ color:"var(--t1)" }}>No lawyer. No office. No appointment.</b>
          </p>
          <div style={{ display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
            {[
              { label:"Hedera Consensus Service", bg:"var(--p-lt)", c:"var(--p-dk)" },
              { label:"WalletConnect Pay", bg:"var(--blue-lt)", c:"var(--blue-dk)" },
              { label:"WorldID", bg:"var(--teal-lt)", c:"var(--teal-dk)" },
            ].map(b => (
              <span key={b.label} style={{ fontSize:12, padding:"4px 12px", borderRadius:20, background:b.bg, color:b.c, fontWeight:500 }}>{b.label}</span>
            ))}
          </div>
        </div>

        {/* Two-column layout */}
        <div style={{ display:"grid", gridTemplateColumns:"380px 1fr", gap:20, alignItems:"start", marginBottom:28 }}>

          {/* LEFT — Submit + explainer */}
          <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
            <SubmitFlow onProofCreated={handleProof} />

            {/* What you can notarize */}
            <div style={{ background:"#fff", border:"0.5px solid var(--bd)", borderRadius:"var(--r-lg)", padding:"16px 20px" }}>
              <div style={{ fontSize:13, fontWeight:600, color:"var(--t0)", marginBottom:12 }}>What can you notarize?</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:6 }}>
                {["Contracts & agreements","Creative work & IP","Medical records","Wills & testaments","Whistleblower reports","Photos & evidence"].map(item => (
                  <div key={item} style={{ padding:"7px 10px", background:"var(--bg2)", borderRadius:"var(--r)", fontSize:12, color:"var(--t1)" }}>{item}</div>
                ))}
              </div>
            </div>

            {/* Privacy explainer */}
            <div style={{ background:"#fff", border:"0.5px solid var(--bd)", borderRadius:"var(--r-lg)", padding:"16px 20px", fontSize:13, color:"var(--t1)", lineHeight:1.7 }}>
              <div style={{ fontWeight:600, color:"var(--t0)", marginBottom:10 }}>How it works</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {[
                  { icon:"📄", text:"Your file is never uploaded — only its SHA-256 fingerprint is sent." },
                  { icon:"⛓", text:"The fingerprint is recorded on Hedera, timestamped by thousands of nodes." },
                  { icon:"📜", text:"You receive an NFT certificate proving the document's existence." },
                ].map(({icon,text}) => (
                  <div key={text} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                    <span style={{ fontSize:14, flexShrink:0 }}>{icon}</span>
                    <span style={{ fontSize:12, color:"var(--t2)", lineHeight:1.6 }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT — Hedera dashboard */}
          <div>
            <HederaDashboard refreshTrigger={tick} newZKEntry={newZKEntry} />
          </div>

        </div>

      </main>

      <footer style={{ borderTop:"0.5px solid var(--bd)", padding:"14px 24px", display:"flex", gap:20, alignItems:"center", background:"#fff", fontSize:12, color:"var(--t2)" }}>
        <span>Built with <a href="https://hedera.com" target="_blank" rel="noreferrer" style={{ color:"var(--p)", textDecoration:"none", fontWeight:500 }}>Hedera</a></span>
        <span>·</span>
        <span><a href="https://walletconnect.com" target="_blank" rel="noreferrer" style={{ color:"var(--blue)", textDecoration:"none", fontWeight:500 }}>WalletConnect Pay</a></span>
        <span>·</span>
        <span><a href="https://unlink.so" target="_blank" rel="noreferrer" style={{ color:"var(--p-dk)", textDecoration:"none", fontWeight:500 }}>Unlink ZK</a></span>
        <div style={{ flex:1 }} />
        <span style={{ color:"var(--t3)" }}>No solidity · No smart contracts · No identity required</span>
      </footer>
    </div>
  );
}
