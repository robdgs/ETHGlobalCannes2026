"use client";

import { useEffect, useState } from "react";
import type { StatusData } from "@/lib/types";

export default function Header() {
  const [status, setStatus] = useState<StatusData | null>(null);

  useEffect(() => {
    fetch("/api/status")
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => {});
  }, []);

  const hashscanBase =
    status?.network === "mainnet"
      ? "https://hashscan.io"
      : "https://hashscan.io/testnet";

  return (
    <header
      style={{
        background: "var(--bg-surface)",
        borderBottom: "0.5px solid var(--border)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 20, color: "var(--hedera-purple)" }}>⬡</span>
          <span style={{ fontWeight: 600, fontSize: 15, letterSpacing: "-0.4px", color: "var(--text-primary)" }}>
            ProvenanceChain
          </span>
          <span
            className="badge badge-purple"
            style={{ textTransform: "uppercase", letterSpacing: "0.5px" }}
          >
            {status?.network ?? "testnet"}
          </span>
        </div>

        {/* Right meta */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {status?.topicId && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-geist-mono)" }}>
              Topic {status.topicId}
            </span>
          )}
          {status?.tokenId && (
            <span style={{ fontSize: 11, color: "var(--text-faint)", fontFamily: "var(--font-geist-mono)" }}>
              Token {status.tokenId}
            </span>
          )}
          {status?.totalMinted !== undefined && (
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {status.totalMinted} NFTs minted
            </span>
          )}
          <a
            href={hashscanBase}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-ghost"
            style={{ padding: "4px 10px", fontSize: 12 }}
          >
            HashScan ↗
          </a>
        </div>
      </div>
    </header>
  );
}
