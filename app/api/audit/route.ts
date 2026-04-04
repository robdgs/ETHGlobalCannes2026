import { NextResponse }         from "next/server";
import { validateHederaEnv }    from "@/lib/hedera/validate";
import { getTopicMessages, getTokenNFTs } from "@/lib/hedera/mirror";

export async function GET() {
  const { ok } = validateHederaEnv();

  // If not configured yet, return empty lists instead of crashing
  if (!ok) {
    return NextResponse.json({ messages: [], nfts: [], warning: "Hedera not configured — run: npm run setup" });
  }

  try {
    const [messages, nfts] = await Promise.all([getTopicMessages(20), getTokenNFTs(20)]);
    return NextResponse.json({ messages, nfts });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
