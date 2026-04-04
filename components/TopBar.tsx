"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function TopBar() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/status").then(r => r.json()).then(d => {
      if (d.totalMinted != null) setCount(d.totalMinted);
    }).catch(() => {});
  }, []);

  return (
    <header style={{
      background: "#fff",
      borderBottom: "0.5px solid var(--bd)",
      padding: "0 24px",
      height: 56,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ width:34, height:34, borderRadius:8, background:"var(--p-lt)", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 6V12L9 16L2 12V6L9 2Z" stroke="#534AB7" strokeWidth="1.5" fill="none"/>
            <circle cx="9" cy="9" r="2.5" fill="#534AB7"/>
          </svg>
        </div>
        <div>
          <div style={{ fontSize:15, fontWeight:600, color:"var(--t0)", letterSpacing:"-0.2px" }}>ProvenanceChain</div>
          <div style={{ fontSize:11, color:"var(--t2)" }}>On-chain notary</div>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", gap:16 }}>
        {count != null && (
          <span style={{ fontSize:13, color:"var(--t2)" }}>
            <b style={{ color:"var(--t0)" }}>{count}</b> documents notarized
          </span>
        )}
        <Link href="/login" style={{ display:"inline-block" }}>
          <button style={{
            padding: "6px 16px",
            fontSize: 13,
            fontWeight: 600,
            border: "1px solid var(--bd)",
            borderRadius: "var(--r)",
            background: "#fff",
            color: "var(--t0)",
            cursor: "pointer",
            transition: "all 0.2s",
          }} onMouseEnter={(e) => {
            e.currentTarget.style.background = "var(--bg2)";
          }} onMouseLeave={(e) => {
            e.currentTarget.style.background = "#fff";
          }}>
            Login
          </button>
        </Link>
        <div style={{ display:"flex", alignItems:"center", gap:6, background:"var(--teal-lt)", padding:"5px 12px", borderRadius:20, fontSize:12, color:"var(--teal-dk)", fontWeight:500 }}>
          <div className="pulse" style={{ width:6, height:6, borderRadius:"50%", background:"var(--teal)" }} />
          Online · Hedera testnet
        </div>
      </div>
    </header>
  );
}
