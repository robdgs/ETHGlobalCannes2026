"use client";
import { useEffect, useState } from "react";

export default function TerminalHeader() {
  const [time,   setTime]   = useState("");
  const [proofs, setProofs] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => setTime(new Date().toISOString().replace("T"," ").split(".")[0]+" UTC");
    tick(); const iv = setInterval(tick, 1000); return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    fetch("/api/status").then(r=>r.json()).then(d=>{
      if (d.totalMinted != null) setProofs(d.totalMinted);
    }).catch(()=>{});
  }, []);

  return (
    <header style={{
      position:"sticky", top:0, zIndex:50,
      borderBottom:"2px solid rgba(123,110,246,0.35)",
      padding:"0 24px", height:52,
      display:"flex", alignItems:"center", justifyContent:"space-between",
      background:"#0E0E12",
    }}>
      <span style={{fontSize:14, color:"var(--g)", letterSpacing:"0.3px", fontWeight:500}}>
        user@provenance-chain
        <span className="glitch" style={{color:"var(--p)"}}>:~$</span>
        {" _"}
      </span>
      <div style={{display:"flex", alignItems:"center", gap:24}}>
        {[["hedera","testnet"],["flare","coston2"],["unlink","polygon"]].map(([l,v])=>(
          <span key={l} style={{fontSize:12, color:"var(--t2)"}}>
            <b style={{color:"var(--t1)"}}>{l}</b>/{v}
          </span>
        ))}
        {proofs != null && (
          <span style={{fontSize:12, color:"var(--t2)"}}>
            proofs <b style={{color:"var(--p)"}}>{proofs}</b>
          </span>
        )}
        <a href="https://hashscan.io/testnet" target="_blank" rel="noreferrer"
          style={{fontSize:12, color:"var(--t2)", textDecoration:"none"}}
          onMouseOver={e=>e.currentTarget.style.color="var(--p)"}
          onMouseOut={e=>e.currentTarget.style.color="var(--t2)"}>hashscan ↗</a>
        <span style={{fontSize:11, color:"var(--t3)", letterSpacing:"0.2px"}}>{time}</span>
      </div>
    </header>
  );
}
