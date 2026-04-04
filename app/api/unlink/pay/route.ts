/**
 * app/api/unlink/pay/route.ts
 *
 * POST /api/unlink/pay
 *
 * Anonymous proof submission via Unlink ZK payments.
 * The full pipeline: Unlink shield → Hedera HCS → HTS NFT → Flare TEE.
 *
 * Body: { docHash, filename, chainId? }
 *
 * The sender is NEVER recorded anywhere in the proof chain.
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { privateSubmit } from "@/lib/unlink/privateSubmit";

export async function POST(req: NextRequest) {
  try {
    const body = await req.formData().catch(() => null);
    const json = body ? null : await req.json().catch(() => ({}));

    // Accept both FormData (file upload) and JSON
    let docHash: string, filename: string, chainId: number;

    if (body) {
      const file    = body.get("file") as File | null;
      const text    = body.get("text") as string | null;
      const content = file
        ? Buffer.from(await file.arrayBuffer())
        : Buffer.from(text ?? "", "utf8");
      docHash   = createHash("sha256").update(content).digest("hex");
      filename  = file?.name ?? "text-submission.txt";
      chainId   = parseInt((body.get("chainId") as string) ?? "137");
    } else {
      docHash   = json?.docHash;
      filename  = json?.filename ?? "unknown";
      chainId   = json?.chainId  ?? 137;
    }

    if (!docHash || !/^[0-9a-f]{64}$/i.test(docHash)) {
      return NextResponse.json({ error: "Invalid docHash." }, { status: 400 });
    }

    const result = await privateSubmit({ docHash, filename, chainId });

    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    console.error("Unlink pay error:", err);
    return NextResponse.json({ error: err.message ?? "Private submission failed" }, { status: 500 });
  }
}
