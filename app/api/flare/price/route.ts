/**
 * app/api/flare/price/route.ts
 * GET /api/flare/price?feed=XRP/USD (default: returns XRP + HBAR + FLR)
 */
import { NextRequest, NextResponse } from "next/server";
import { getFTSOPrice, getRewardPricing } from "@/lib/flare/ftso";

export async function GET(req: NextRequest) {
  const feed = req.nextUrl.searchParams.get("feed");

  try {
    if (feed) {
      const price = await getFTSOPrice(feed as any);
      return NextResponse.json({ price });
    }

    // Default: return full pricing context
    const pricing = await getRewardPricing();
    return NextResponse.json({ pricing });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
