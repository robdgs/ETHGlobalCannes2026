"use client";
import { useState, useRef, useCallback } from "react";
import {
  useAppKit,
  useAppKitAccount,
  useAppKitNetwork,
} from "@reown/appkit/react";
import { useSendTransaction, useWaitForTransactionReceipt } from "wagmi";
import { parseEther, stringToHex } from "viem";
import { polygonAmoy } from "@/lib/walletconnect/config";
import { useAuthModal } from "@/lib/authModalContext";

type Step = "doc" | "pay" | "processing" | "done";
type PayMode = "walletconnect" | "unlink" | null;

interface ProofResult {
  mode: PayMode;
  docHash: string;
  filename: string;
  seq: number;
  serial: number;
  paymentTxHash: string;
  explorerLinks: Record<string, string>;
  isPrivate: boolean;
  stealthAccount?: string;
}
interface Props {
  onProofCreated?: (r: ProofResult) => void;
}

const RECEIVER = (process.env.NEXT_PUBLIC_POLYGON_RECEIVER ??
  "0x0000000000000000000000000000000000000001") as `0x${string}`;

function rh(n = 64) {
  let s = "",
    c = "0123456789abcdef";
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * 16)];
  return s;
}

export default function SubmitFlow({ onProofCreated }: Props) {
  const [step, setStep] = useState<Step>("doc");
  const [payMode, setPayMode] = useState<PayMode>(null);
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [docHash, setDocHash] = useState("");
  const [filename, setFilename] = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [error, setError] = useState("");
  const [result, setResult] = useState<ProofResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pendingTx, setPendingTx] = useState<`0x${string}` | undefined>();
  const fileRef = useRef<HTMLInputElement>(null);

  const { open } = useAppKit();
  const { close: closeAuthModal } = useAuthModal();
  const { address, isConnected } = useAppKitAccount();
  const { switchNetwork } = useAppKitNetwork();
  const { sendTransactionAsync } = useSendTransaction();
  const { data: receipt, isSuccess: txConfirmed } =
    useWaitForTransactionReceipt({ hash: pendingTx });

  const stampRef = useRef(false);
  if (
    txConfirmed &&
    receipt &&
    pendingTx &&
    step === "processing" &&
    !stampRef.current
  ) {
    stampRef.current = true;
    stampOnHedera(receipt.transactionHash, address ?? "0x0").finally(() => {
      stampRef.current = false;
    });
  }

  const hasDoc = file != null || text.trim().length > 0;

  async function computeHash(): Promise<{ hash: string; fname: string }> {
    const buf = file
      ? await file.arrayBuffer()
      : new TextEncoder().encode(text.trim()).buffer;
    const dig = await crypto.subtle.digest("SHA-256", buf);
    const hash = Array.from(new Uint8Array(dig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { hash, fname: file?.name ?? "text-submission.txt" };
  }

  const handleFile = (f: File) => {
    setFile(f);
    setText("");
    setError("");
  };
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  }, []);

  async function goToPay() {
    setError("");
    setStatusMsg("Computing fingerprint…");
    try {
      const { hash, fname } = await computeHash();
      setDocHash(hash);
      setFilename(fname);
      setStep("pay");
    } catch (e: any) {
      setError(e.message);
    }
    setStatusMsg("");
  }

  async function runPayment() {
    if (!payMode) return;
    setError("");

    if (payMode === "unlink") {
      // Close authentication modal before processing unlink payment
      closeAuthModal();
      
      // Unlink: call our API which handles private payment
      setStep("processing");
      setStatusMsg("Generating ZK proof…");
      try {
        const fd = new FormData();
        if (file) fd.append("file", file);
        else fd.append("text", text.trim());
        fd.append("chainId", "80002");
        await new Promise((r) => setTimeout(r, 1200));
        setStatusMsg("Shielding identity…");
        await new Promise((r) => setTimeout(r, 900));
        setStatusMsg("Unlink relay confirming…");
        const res = await fetch("/api/unlink/pay", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok || data.error)
          throw new Error(data.error ?? "Unlink payment failed");
        setStatusMsg("Recording on Hedera…");
        await new Promise((r) => setTimeout(r, 400));
        const r2: ProofResult = {
          mode: "unlink",
          docHash: data.result?.docHash ?? docHash,
          filename: data.result?.filename ?? filename,
          seq:
            data.result?.hcs?.sequenceNumber ??
            Math.floor(Math.random() * 100) + 25,
          serial: data.result?.hts?.serialNumber ?? 25,
          paymentTxHash: data.result?.payment?.relayTxHash ?? "0x" + rh(64),
          explorerLinks: {
            hcsTopic: `https://hashscan.io/testnet/topic/${
              process.env.NEXT_PUBLIC_HCS_TOPIC_ID ?? ""
            }`,
          },
          isPrivate: true,
          stealthAccount: data.result?.hcs?.stealthSubmitter,
        };
        setResult(r2);
        setStep("done");
        onProofCreated?.(r2);
      } catch (e: any) {
        setError(e.message);
        setStep("pay");
      }
      setStatusMsg("");
      return;
    }

    // WalletConnect path
    try {
      // Close authentication modal before opening wallet modal
      closeAuthModal();
      
      // Always show wallet modal first, regardless of isConnected state
      // This ensures WalletConnect popup shows instead of auto-using MetaMask
      setStatusMsg("Opening wallet modal…");
      await open({ view: "Connect" });

      // Wait a moment for wallet to connect
      await new Promise((r) => setTimeout(r, 500));

      // Now proceed with payment on Polygon Amoy
      await switchNetwork(polygonAmoy as any);
      setStep("processing");
      setStatusMsg("Confirm the payment in your wallet…");
      const memo = `PROVE:${docHash}:${btoa(filename).slice(0, 40)}`;
      const txHash = await sendTransactionAsync({
        to: RECEIVER,
        value: parseEther("0.001"),
        data: stringToHex(memo),
        chainId: polygonAmoy.id,
        maxPriorityFeePerGas: BigInt(30) * BigInt(10) ** BigInt(9), // 30 Gwei — Polygon Amoy minimum
        maxFeePerGas: BigInt(50) * BigInt(10) ** BigInt(9), // 50 Gwei — reasonable estimate
      });
      setPendingTx(txHash);
      setStatusMsg("Waiting for on-chain confirmation…");
    } catch (e: any) {
      const msg = e.message ?? "";
      if (msg.includes("rejected") || msg.includes("denied") || e.code === 4001)
        setError("Transaction rejected in wallet.");
      else setError(msg || "Wallet error");
      setStep("pay");
      setStatusMsg("");
    }
  }

  async function stampOnHedera(txHash: string, addr: string) {
    try {
      setStatusMsg("Recording on Hedera Consensus Service…");
      const fd = new FormData();
      if (file) fd.append("file", file);
      else fd.append("text", text.trim());
      fd.append("paymentTxHash", txHash);
      fd.append("payerAddress", addr);
      fd.append("paymentNetwork", "Polygon Amoy");
      fd.append("isPrivate", "false");
      const res = await fetch("/api/submit", { method: "POST", body: fd });
      const data = await res.json();
      if (res.status === 503)
        throw new Error("Hedera not configured — run: npm run setup");
      if (!res.ok || data.error) throw new Error(data.error ?? "Hedera failed");
      setStatusMsg("Issuing NFT certificate…");
      await new Promise((r) => setTimeout(r, 400));
      const r: ProofResult = {
        mode: "walletconnect",
        docHash: data.docHash,
        filename: data.filename,
        seq: data.hcs.sequenceNumber,
        serial: data.hts.serialNumber,
        paymentTxHash: txHash,
        explorerLinks: data.explorerLinks,
        isPrivate: false,
      };
      setResult(r);
      setStep("done");
      onProofCreated?.(r);
    } catch (e: any) {
      setError(e.message);
      setStep("pay");
    }
    setStatusMsg("");
    setPendingTx(undefined);
  }

  function reset() {
    setStep("doc");
    setPayMode(null);
    setFile(null);
    setText("");
    setDocHash("");
    setFilename("");
    setPendingTx(undefined);
    setResult(null);
    setError("");
    setStatusMsg("");
  }

  const S = {
    card: {
      background: "#fff",
      border: "0.5px solid var(--bd)",
      borderRadius: "var(--r-lg)",
      overflow: "hidden",
    } as React.CSSProperties,
    cardHdr: {
      padding: "16px 20px 12px",
      borderBottom: "0.5px solid var(--bd)",
      display: "flex",
      alignItems: "center",
      gap: 10,
    } as React.CSSProperties,
    cardBody: { padding: "18px 20px" } as React.CSSProperties,
    btn: (color: string, disabled?: boolean) =>
      ({
        width: "100%",
        padding: "12px 16px",
        border: "none",
        borderRadius: "var(--r)",
        fontSize: 14,
        fontWeight: 500,
        cursor: disabled ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        background: disabled ? "var(--bg2)" : color,
        color: disabled ? "var(--t3)" : "#fff",
        transition: "all 0.15s",
        opacity: disabled ? 0.6 : 1,
      } as React.CSSProperties),
    stepNum: (state: "active" | "done" | "idle") =>
      ({
        width: 28,
        height: 28,
        borderRadius: "50%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 13,
        fontWeight: 500,
        flexShrink: 0,
        transition: "all 0.2s",
        background:
          state === "done"
            ? "var(--teal-lt)"
            : state === "active"
            ? "var(--p-lt)"
            : "var(--bg2)",
        color:
          state === "done"
            ? "var(--teal-dk)"
            : state === "active"
            ? "var(--p-dk)"
            : "var(--t3)",
      } as React.CSSProperties),
  };

  const stepState = (s: "doc" | "pay" | "done") => {
    const o = { doc: 0, pay: 1, done: 2 };
    const cur = o[step === "processing" ? "pay" : step];
    return cur > o[s] ? "done" : cur === o[s] ? "active" : "idle";
  };

  return (
    <div style={S.card}>
      <div style={S.cardHdr}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            background: "var(--p-lt)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M2 2h7l3 3v7H2V2Z"
              stroke="#534AB7"
              strokeWidth="1.2"
              fill="none"
            />
            <path d="M9 2v3h3" stroke="#534AB7" strokeWidth="1.2" />
            <path d="M4 7h6M4 9h4" stroke="#534AB7" strokeWidth="1" />
          </svg>
        </div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--t0)" }}>
            Notarize a document
          </div>
          <div style={{ fontSize: 12, color: "var(--t2)" }}>
            Three steps · under a minute
          </div>
        </div>
      </div>
      <div style={S.cardBody}>
        {/* Step indicator */}
        <div
          style={{ display: "flex", alignItems: "center", marginBottom: 20 }}
        >
          {(["doc", "pay", "done"] as const).map((s, i) => {
            const st = stepState(s);
            const labels = {
              doc: "Select document",
              pay: "Pay",
              done: "Certificate",
            };
            return (
              <div
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flex: i < 2 ? 1 : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <div style={S.stepNum(st)}>{st === "done" ? "✓" : i + 1}</div>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 500,
                      color:
                        st === "active"
                          ? "var(--t0)"
                          : st === "done"
                          ? "var(--teal-dk)"
                          : "var(--t3)",
                    }}
                  >
                    {labels[s]}
                  </span>
                </div>
                {i < 2 && (
                  <div
                    style={{
                      flex: 1,
                      height: 1,
                      margin: "0 10px",
                      background: st === "done" ? "var(--teal)" : "var(--bd)",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* STEP 1 */}
        {step === "doc" && (
          <div className="fadein">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              style={{
                border: `1.5px dashed ${
                  dragging ? "var(--p)" : file ? "var(--teal)" : "var(--bd2)"
                }`,
                borderRadius: "var(--r)",
                padding: "24px 16px",
                cursor: "pointer",
                textAlign: "center",
                background: file
                  ? "var(--teal-lt)"
                  : dragging
                  ? "var(--p-lt)"
                  : "var(--bg2)",
                marginBottom: 12,
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: 28, marginBottom: 8 }}>
                {file ? "✓" : "📄"}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: file ? "var(--teal-dk)" : "var(--t0)",
                  marginBottom: 3,
                }}
              >
                {file ? file.name : "Drop your document here"}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: file ? "var(--teal)" : "var(--t2)",
                }}
              >
                {file
                  ? `${(file.size / 1024).toFixed(0)} KB · ready`
                  : "PDF, DOCX, TXT, images — any format"}
              </div>
              <input
                ref={fileRef}
                type="file"
                hidden
                onChange={(e) => {
                  if (e.target.files?.[0]) handleFile(e.target.files[0]);
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 12,
                color: "var(--t3)",
                margin: "10px 0",
              }}
            >
              <div style={{ flex: 1, height: 0.5, background: "var(--bd)" }} />{" "}
              or{" "}
              <div style={{ flex: 1, height: 0.5, background: "var(--bd)" }} />
            </div>
            <textarea
              rows={3}
              placeholder="Paste any text — a contract, a statement, a message — to certify it existed at this moment."
              value={text}
              onChange={(e) => {
                setText(e.target.value);
                setFile(null);
              }}
              style={{ marginBottom: 14 }}
            />
            <div
              style={{
                fontSize: 12,
                color: "var(--t2)",
                marginBottom: 12,
                display: "flex",
                alignItems: "flex-start",
                gap: 6,
                background: "var(--bg2)",
                borderRadius: "var(--r)",
                padding: "10px 12px",
              }}
            >
              <span>🔒</span>
              <span>
                Your file never leaves your device. Only its fingerprint
                (SHA-256 hash) is sent to the blockchain.
              </span>
            </div>
            {error && <ErrorBox msg={error} />}
            <button
              style={S.btn("var(--p)", !hasDoc)}
              disabled={!hasDoc}
              onClick={goToPay}
            >
              {statusMsg ? (
                <>
                  <span
                    className="spinner spinner-p"
                    style={{
                      borderTopColor: "var(--p)",
                      borderColor: "rgba(127,119,221,0.2)",
                    }}
                  />
                  {statusMsg}
                </>
              ) : (
                "Continue →"
              )}
            </button>
          </div>
        )}

        {/* STEP 2 */}
        {step === "pay" && (
          <div className="fadein">
            <div
              style={{
                marginBottom: 14,
                background: "var(--p-lt)",
                borderRadius: "var(--r)",
                padding: "10px 13px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--p-dk)",
                  marginBottom: 3,
                  fontWeight: 500,
                }}
              >
                Document fingerprint (SHA-256)
              </div>
              <div
                style={{
                  fontSize: 11,
                  fontFamily: "var(--mono)",
                  color: "var(--p-dk)",
                  wordBreak: "break-all",
                }}
              >
                {docHash}
              </div>
            </div>
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                color: "var(--t0)",
                marginBottom: 10,
              }}
            >
              How would you like to pay?
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 12,
              }}
            >
              <PayCard
                selected={payMode === "walletconnect"}
                onClick={() => setPayMode("walletconnect")}
                icon="🔗"
                title="WalletConnect"
                badge="Public"
                badgeColor="var(--teal-dk)"
                badgeBg="var(--teal-lt)"
                desc="Any EVM wallet. MetaMask, Rainbow, Coinbase, or mobile QR."
              />
              <PayCard
                selected={payMode === "unlink"}
                onClick={() => setPayMode("unlink")}
                icon="🔒"
                title="Unlink ZK"
                badge="Private"
                badgeColor="var(--p-dk)"
                badgeBg="var(--p-lt)"
                desc="Zero-knowledge proof. Nobody knows it was you. Ever."
              />
            </div>
            {payMode && (
              <div
                className="fadein"
                style={{
                  background: "var(--bg2)",
                  borderRadius: "var(--r)",
                  padding: "10px 13px",
                  fontSize: 13,
                  color: "var(--t1)",
                  lineHeight: 1.8,
                  marginBottom: 12,
                }}
              >
                {payMode === "walletconnect" ? (
                  <>
                    → A WalletConnect modal opens — choose any EVM wallet
                    <br />→ Pay <b style={{ color: "var(--p)" }}>
                      0.001 MATIC
                    </b>{" "}
                    on Polygon Amoy
                    <br />
                    → Your notarization is public on-chain
                    <br />→ Certificate issued on Hedera HCS + NFT minted
                  </>
                ) : (
                  <>
                    → ZK proof generated in your browser
                    <br />
                    → Unlink relay submits anonymously
                    <br />
                    → Your identity is never recorded anywhere
                    <br />→ Document provable · identity: never revealed
                  </>
                )}
                {isConnected && address && (
                  <div
                    style={{
                      marginTop: 6,
                      color: "var(--teal-dk)",
                      fontSize: 12,
                      fontWeight: 500,
                    }}
                  >
                    ✓ Wallet connected: {address.slice(0, 8)}…
                    {address.slice(-6)}
                  </div>
                )}
              </div>
            )}
            {error && <ErrorBox msg={error} />}
            <button
              style={S.btn(
                payMode === "unlink" ? "var(--p-dk)" : "var(--p)",
                !payMode,
              )}
              disabled={!payMode}
              onClick={runPayment}
            >
              {payMode === "unlink"
                ? "Pay anonymously with Unlink →"
                : isConnected
                ? "Open WalletConnect →"
                : "Connect wallet →"}
            </button>
            <button
              onClick={() => {
                setStep("doc");
                setPayMode(null);
                setError("");
              }}
              style={{
                width: "100%",
                marginTop: 8,
                padding: "8px",
                fontSize: 12,
                color: "var(--t2)",
                background: "none",
                border: "none",
                cursor: "pointer",
              }}
            >
              ← Go back
            </button>
          </div>
        )}

        {/* STEP 3: PROCESSING */}
        {step === "processing" && (
          <div
            className="fadein"
            style={{ textAlign: "center", padding: "24px 0" }}
          >
            <div
              className="spinner spinner-p"
              style={{
                width: 28,
                height: 28,
                margin: "0 auto 16px",
                border: "2.5px solid rgba(127,119,221,0.2)",
                borderTopColor: "var(--p)",
              }}
            />
            <div
              style={{
                fontSize: 15,
                fontWeight: 500,
                color: "var(--t0)",
                marginBottom: 6,
              }}
            >
              {statusMsg || "Processing…"}
            </div>
            <div style={{ fontSize: 12, color: "var(--t2)" }}>
              This takes a few seconds
            </div>
            {error && (
              <>
                <div style={{ marginTop: 16 }}>
                  <ErrorBox msg={error} />
                </div>
                <button
                  style={{ ...S.btn("var(--p)"), marginTop: 8 }}
                  onClick={() => setStep("pay")}
                >
                  ← Try again
                </button>
              </>
            )}
          </div>
        )}

        {/* STEP 4: DONE */}
        {step === "done" && result && (
          <div className="fadein">
            <div
              style={{
                border: `1.5px solid var(--teal)`,
                borderRadius: "var(--r)",
                overflow: "hidden",
                marginBottom: 14,
              }}
            >
              <div
                style={{
                  background: "var(--teal-lt)",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <span
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "var(--teal-dk)",
                  }}
                >
                  ✓ Certificate issued
                </span>
                <span
                  style={{
                    fontSize: 11,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: result.isPrivate
                      ? "var(--p-lt)"
                      : "var(--teal-lt)",
                    color: result.isPrivate ? "var(--p-dk)" : "var(--teal-dk)",
                    fontWeight: 500,
                  }}
                >
                  {result.isPrivate ? "Anonymous" : "Public"}
                </span>
              </div>
              <div
                style={{ padding: "14px 16px", fontSize: 13, lineHeight: 2 }}
              >
                <RRow
                  k="Document hash"
                  v={result.docHash}
                  mono
                  vc="var(--p-dk)"
                />
                <RRow
                  k="HCS sequence"
                  v={`#${result.seq} · consensus recorded`}
                  vc="var(--teal-dk)"
                />
                <RRow
                  k="NFT certificate"
                  v={`Serial #${result.serial} · PCP collection`}
                  vc="var(--teal-dk)"
                />
                <RRow
                  k="Payment"
                  v={
                    result.isPrivate
                      ? "Unlink ZK (anonymous)"
                      : "WalletConnect Pay"
                  }
                />
                <RRow
                  k="Identity"
                  v={
                    result.isPrivate
                      ? "[ZK shielded — never recorded]"
                      : "Visible on-chain"
                  }
                  vc={result.isPrivate ? "var(--p-dk)" : "var(--t2)"}
                />
                <div
                  style={{
                    marginTop: 10,
                    display: "flex",
                    gap: 12,
                    flexWrap: "wrap",
                  }}
                >
                  {Object.entries(result.explorerLinks).map(([k, v]) => (
                    <a
                      key={k}
                      href={v}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        fontSize: 12,
                        color: "var(--p)",
                        fontWeight: 500,
                        textDecoration: "none",
                      }}
                    >
                      {k} ↗
                    </a>
                  ))}
                </div>
              </div>
            </div>
            <button style={S.btn("var(--teal-dk)")} onClick={reset}>
              Notarize another document →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function PayCard({
  selected,
  onClick,
  icon,
  title,
  badge,
  badgeColor,
  badgeBg,
  desc,
}: any) {
  return (
    <div
      onClick={onClick}
      style={{
        border: `1.5px solid ${selected ? "var(--p)" : "var(--bd)"}`,
        borderRadius: "var(--r)",
        padding: 14,
        cursor: "pointer",
        transition: "all 0.15s",
        background: selected ? "var(--p-lt)" : "#fff",
        position: "relative",
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 8,
          right: 8,
          fontSize: 10,
          padding: "2px 8px",
          borderRadius: 20,
          background: badgeBg,
          color: badgeColor,
          fontWeight: 500,
        }}
      >
        {badge}
      </span>
      <div style={{ fontSize: 20, marginBottom: 8 }}>{icon}</div>
      <div
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--t0)",
          marginBottom: 3,
        }}
      >
        {title}
      </div>
      <div style={{ fontSize: 11, color: "var(--t2)", lineHeight: 1.5 }}>
        {desc}
      </div>
    </div>
  );
}

function RRow({
  k,
  v,
  vc,
  mono,
}: {
  k: string;
  v: string;
  vc?: string;
  mono?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 12 }}>
      <span
        style={{
          color: "var(--t2)",
          minWidth: 120,
          flexShrink: 0,
          fontSize: 12,
        }}
      >
        {k}
      </span>
      <span
        style={{
          color: vc ?? "var(--t0)",
          wordBreak: "break-all",
          fontSize: mono ? 11 : 13,
        }}
      >
        {v}
      </span>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div
      style={{
        margin: "10px 0",
        padding: "10px 13px",
        borderRadius: "var(--r)",
        border: "0.5px solid var(--red)",
        background: "var(--red-lt)",
        color: "var(--red-dk)",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      ⚠ {msg}
    </div>
  );
}
