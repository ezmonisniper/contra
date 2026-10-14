import { errorResponse, json, PublicError, rateLimit } from "@/lib/http";
import { resolveMarket } from "@/lib/jupiter";
import { MarketQuery } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** GET /api/markets/resolve?q=<question> -> the matching Solana-tradable market with live prices. */
export async function GET(req: Request) {
  try {
    rateLimit(req, "resolve", 30, 60_000);
    const { q } = MarketQuery.parse(Object.fromEntries(new URL(req.url).searchParams));
    const market = await resolveMarket(q);
    if (!market) throw new PublicError("This market isn't tradable on Solana yet.", 404, "not_on_solana");
    if (market.status !== "open") throw new PublicError("This market is closed for trading.", 409, "market_closed");
    return json({ market });
  } catch (err) {
    return errorResponse(err);
  }
}
