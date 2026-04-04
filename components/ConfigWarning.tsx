"use client";
import { useEffect, useState } from "react";

export default function ConfigWarning() {
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/status")
      .then(r => r.json())
      .then(d => { if (d.status==="misconfigured" && d.errors?.length) setErrors(d.errors); })
      .catch(() => {});
  }, []);

  if (!errors.length) return null;

  return (
    <div style={{ margin:"0 24px 0", padding:"14px 18px", borderRadius:"var(--r)", border:"0.5px solid var(--red)", background:"var(--red-lt)", fontSize:13, color:"var(--red-dk)" }}>
      <div style={{ fontWeight:600, marginBottom:8 }}>⚠ Setup required before you can notarize documents</div>
      <ol style={{ paddingLeft:18, lineHeight:2 }}>
        {errors.map((e,i) => <li key={i}>{e}</li>)}
      </ol>
      <div style={{ marginTop:10, color:"var(--t1)", lineHeight:1.8 }}>
        <b>Fix:</b> copy <code style={{ background:"rgba(0,0,0,0.06)", padding:"1px 6px", borderRadius:4 }}>.env.local.example → .env.local</code>, fill in your Hedera credentials from <a href="https://portal.hedera.com" target="_blank" rel="noreferrer" style={{ color:"var(--p)" }}>portal.hedera.com</a>, then run <code style={{ background:"rgba(0,0,0,0.06)", padding:"1px 6px", borderRadius:4 }}>npm run setup</code>.
      </div>
    </div>
  );
}
