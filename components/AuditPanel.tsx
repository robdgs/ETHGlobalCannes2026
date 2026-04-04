"use client";
import { useState, useEffect, useCallback } from "react";

type Tab = "h" | "n" | "t" | "u";

interface ZKEntry { seq:number; hash:string; filename:string; nullifier:string; ts:string; }
interface Props    { refreshTrigger:number; newZKEntry?:ZKEntry|null; }

function fmtTs(ts:string) {
  if (!ts) return "—";
  const d = new Date(parseFloat(ts)*1000);
  return d.toLocaleString(undefined,{month:"2-digit",day:"2-digit",year:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit"});
}

const SEED_HCS = [
  {seq:24,ts:"1743170331.000",hash:"a3f9b2c1d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",fn:"contract-final-v3.pdf",sub:"0.0.4820001"},
  {seq:23,ts:"1743159264.000",hash:"c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8",fn:"patent-application.docx",sub:"0.0.4819882"},
  {seq:22,ts:"1743070503.000",hash:"f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1",fn:"whistleblower-report.txt",sub:"0.0.4801234"},
];

export default function AuditPanel({ refreshTrigger, newZKEntry }: Props) {
  const [tab,     setTab]     = useState<Tab>("h");
  const [hcs,     setHcs]     = useState(SEED_HCS);
  const [nfts,    setNfts]    = useState<any[]>([]);
  const [zks,     setZks]     = useState<ZKEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [vHash,   setVHash]   = useState("");
  const [vRes,    setVRes]    = useState<{ok:boolean;msg:string}|null>(null);
  const [vBusy,   setVBusy]   = useState(false);

  useEffect(()=>{ if(newZKEntry) setZks(p=>[newZKEntry,...p]); },[newZKEntry]);

  const load = useCallback(async ()=>{
    setLoading(true);
    try {
      const r  = await fetch("/api/audit");
      const d  = await r.json();
      if (d.messages?.length) setHcs(d.messages.map((m:any)=>({seq:m.sequenceNumber,ts:m.consensusTimestamp,hash:m.message?.docHash,fn:m.message?.filename,sub:m.message?.submitter})));
      if (d.nfts?.length)     setNfts(d.nfts);
    } catch {}
    setLoading(false);
  },[]);

  useEffect(()=>{ if(refreshTrigger>0) load(); },[load,refreshTrigger]);

  async function runVerify() {
    const h = vHash.trim(); if(!h) return;
    setVBusy(true); setVRes(null);
    try {
      const r = await fetch(`/api/verify?hash=${encodeURIComponent(h)}`);
      const d = await r.json();
      setVRes(d.verified
        ? {ok:true,  msg:`✓ Verified — HCS sequence #${d.proof?.sequenceNumber} — ${d.proof?.consensusTimestamp}`}
        : {ok:false, msg:"Not found on Hedera ledger."});
    } catch { setVRes({ok:false,msg:"Query failed."}); }
    setVBusy(false);
  }

  const TABS = [
    {id:"h" as Tab, label:"HCS proofs",   count:hcs.length},
    {id:"n" as Tab, label:"NFT mints",    count:nfts.length},
    {id:"u" as Tab, label:"ZK private",   count:zks.length},
  ];

  return (
    <div style={{fontFamily:"var(--mono)"}}>

      {/* Verify */}
      <div style={{padding:"14px 18px",borderBottom:"1.5px solid var(--bd)",background:"var(--bg1)"}}>
        <div style={{fontSize:12,color:"var(--t2)",marginBottom:8,fontWeight:500,letterSpacing:"0.5px"}}>
          VERIFY DOCUMENT HASH
        </div>
        <div style={{display:"flex",gap:8}}>
          <input type="text" value={vHash} onChange={e=>setVHash(e.target.value)} placeholder="Paste your SHA-256 hash here (64 hex characters)"
            onKeyDown={e=>e.key==="Enter"&&runVerify()} style={{flex:1,marginBottom:0}}/>
          <button onClick={runVerify} disabled={vBusy} style={{
            padding:"10px 16px",background:"var(--bg2)",border:"1.5px solid var(--bd)",
            color:"var(--t1)",fontSize:13,whiteSpace:"nowrap",transition:"all 0.15s",fontWeight:500,
          }}
          onMouseOver={e=>{e.currentTarget.style.borderColor="var(--p)";e.currentTarget.style.color="var(--p)";}}
          onMouseOut={e=>{e.currentTarget.style.borderColor="var(--bd)";e.currentTarget.style.color="var(--t1)";}}>
            {vBusy?<span className="spinner"/>:"Check →"}
          </button>
        </div>
        {vRes && (
          <div className="fadein" style={{marginTop:10,fontSize:13,padding:"10px 12px",border:`1.5px solid ${vRes.ok?"var(--teal)":"var(--fl)"}`,color:vRes.ok?"var(--teal)":"var(--fl)",background:vRes.ok?"rgba(10,191,163,0.06)":"rgba(232,65,66,0.06)"}}>
            {vRes.msg}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1.5px solid var(--bd)"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            flex:1,padding:"10px 8px",background:tab===t.id?"rgba(123,110,246,0.1)":"var(--bg1)",
            border:"none",borderRight:"1.5px solid var(--bd)",
            color:tab===t.id?"var(--p)":"var(--t2)",
            fontSize:13,fontWeight:tab===t.id?600:400,letterSpacing:"0.2px",transition:"all 0.15s",cursor:"pointer",
          }}>
            {t.label} ({t.count})
          </button>
        ))}
      </div>

      {/* HCS */}
      {tab==="h" && (
        <div style={{padding:"14px 18px"}}>
          {loading && <div style={{fontSize:13,color:"var(--t3)",marginBottom:10}}><span className="spinner"/> Querying Mirror Node…</div>}
          {hcs.length===0 && !loading && <EmptyState msg="No proofs yet — submit a document to see it here."/>}
          {hcs.map((m,i)=>(
            <Entry key={i} seq={`#${m.seq}`} seqColor="var(--p)" ts={fmtTs(m.ts)} filename={m.fn}
              hash={m.hash} tags={[m.sub,"DOCUMENT_PROOF"]}/>
          ))}
        </div>
      )}

      {/* NFT */}
      {tab==="n" && (
        <div style={{padding:"14px 18px"}}>
          {nfts.length===0 && <EmptyState msg="NFT data loads after first proof is stamped."/>}
          {nfts.map((n:any,i:number)=>(
            <Entry key={i} seq={`#${n.serialNumber}`} seqColor="var(--t1)" ts={fmtTs(n.createdTimestamp)}
              filename={n.metadata?.f} tags={[`owner: ${n.accountId}`,`hcs#${n.metadata?.seq}`]}/>
          ))}
        </div>
      )}

      {/* ZK */}
      {tab==="u" && (
        <div style={{padding:"14px 18px"}}>
          {zks.length===0 && <EmptyState msg="No anonymous submissions yet. Choose Unlink ZK payment to submit privately."/>}
          {zks.map((z,i)=>(
            <Entry key={i} seq={`ZK/${z.seq}`} seqColor="var(--p)" ts={z.ts}
              filename={`${z.filename} [anonymous]`}
              hash={`nullifier: ${z.nullifier?.slice(0,32)}…`}
              tags={["ZK_PROVEN","sender: [private]"]} tagColors={["var(--p)",undefined]}/>
          ))}
        </div>
      )}

      <div style={{borderTop:"1.5px solid var(--bd)",padding:"10px 16px",background:"var(--bg1)"}}>
        <button onClick={load} style={{
          padding:"8px 16px",background:"var(--bg2)",border:"1.5px solid var(--bd)",
          color:"var(--t1)",fontSize:13,transition:"all 0.15s",fontWeight:500,
        }}
        onMouseOver={e=>{e.currentTarget.style.borderColor="var(--p)";e.currentTarget.style.color="var(--p)";}}
        onMouseOut={e=>{e.currentTarget.style.borderColor="var(--bd)";e.currentTarget.style.color="var(--t1)";}}>
          ↻ Refresh from Mirror Node
        </button>
      </div>
    </div>
  );
}

function Entry({seq,seqColor,ts,filename,hash,tags,tagColors}:{seq:string;seqColor:string;ts:string;filename?:string;hash?:string;tags?:string[];tagColors?:(string|undefined)[];}){
  return(
    <div className="fadein" style={{borderBottom:"1px solid var(--bd)",padding:"12px 0",fontSize:13,lineHeight:1.8}}>
      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
        <span style={{color:seqColor,fontWeight:600,letterSpacing:"0.3px"}}>{seq}</span>
        <span style={{color:"var(--t3)",fontSize:12}}>{ts}</span>
      </div>
      {filename&&<div style={{color:"var(--t1)",marginBottom:2,fontWeight:500}}>{filename}</div>}
      {hash&&<div style={{color:"var(--t3)",wordBreak:"break-all",marginBottom:4,fontSize:11}}>{hash}</div>}
      {tags&&<div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
        {tags.map((t,i)=><span key={i} style={{color:tagColors?.[i]??"var(--t2)",fontSize:11}}>[{t}]</span>)}
      </div>}
    </div>
  );
}

function EmptyState({msg}:{msg:string}){
  return <div style={{fontSize:13,color:"var(--t3)",padding:"20px 0",lineHeight:1.7}}>// {msg}</div>;
}
