/**
 * app/api/certificate/route.ts
 *
 * GET /api/certificate?fileId=0.0.XXXXX
 *
 * Fetches the HTML certificate stored on Hedera File Service and serves it
 * directly to the browser — no client-side decoding needed.
 *
 * The certificate is stored as raw HTML on HFS. This route acts as a
 * gateway, reading from the ledger via FileContentsQuery and streaming
 * the response with the correct Content-Type.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHederaEnv } from "@/lib/hedera/validate";
import { readFromHFS } from "@/lib/hedera/hfs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  // Validate Hedera env
  try {
    requireHederaEnv();
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 503 });
  }

  const fileId = req.nextUrl.searchParams.get("fileId")?.trim();

  // Validate fileId format: 0.0.NNNNN
  if (!fileId || !/^0\.0\.\d+$/.test(fileId)) {
    return NextResponse.json(
      { error: "?fileId= must be a valid Hedera file ID (e.g. 0.0.12345)" },
      { status: 400 },
    );
  }

  try {
    const content = await readFromHFS(fileId);
    const text = content.toString("utf8");

    // Detect content type — we store HTML, but be defensive
    const isHTML =
      text.trimStart().startsWith("<!DOCTYPE") ||
      text.trimStart().startsWith("<html");

    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": isHTML ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
        // Allow browser caching — the file is immutable on HFS
        "Cache-Control": "public, max-age=31536000, immutable",
        // Useful for "Save as" in browser
        "Content-Disposition": `inline; filename="provenance-certificate-${fileId}.html"`,
      },
    });
  } catch (err: any) {
    // File not found or expired
    if (
      err.message?.includes("FILE_DELETED") ||
      err.message?.includes("INVALID_FILE_ID")
    ) {
      return NextResponse.json(
        { error: `Certificate file ${fileId} not found or has expired.` },
        { status: 404 },
      );
    }
    console.error("HFS read error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}