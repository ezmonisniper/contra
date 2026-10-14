import { z } from "zod";
import { getFadeList } from "@/lib/data";
import { env } from "@/lib/env";
import { fadeAllowed } from "@/lib/fade-list";
import { cents } from "@/lib/format";
import { assertSameOrigin, errorResponse, json, PublicError, rateLimit, readJson } from "@/lib/http";
import { createOrder, getMarket } from "@/lib/jupiter";
import { assertOnlySigner, decodeTx } from "@/lib/tx";
import { fadeAmount, SolanaPubkey, UpstreamId } from "@/lib/validate";

export const dynamic = "force-dynamic";

/**
 * POST /api/orders  { ownerPubkey, marketId, isYes, amountUsd }
 * Returns an UNSIGNED transaction for the user's wallet to sign. Contra never signs or holds funds.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    rateLimit(req, "orders", 10, 60_000);
    const { CONTRA_MAX_FADE_USD } = env();
    const body = z
      .object({
        ownerPubkey: SolanaPubkey,
        marketId: UpstreamId,
        isYes: z.boolean(),
        amountUsd: fadeAmount(CONTRA_MAX_FADE_USD),
      })
      .strict()
      .parse(await readJson(req));

    // Re-check the live price on the server: the fade policy holds even if the page is stale or tampered with.
    const market = await getMarket(body.marketId);
    if (market.status !== "open") throw new PublicError("This market is closed for trading.", 409, "market_closed");
    const price = body.isYes ? market.buyYes : market.buyNo;
    if (price == null) throw new PublicError("No live price for this side right now.", 409, "no_price");
    const { policy } = getFadeList();
    if (!fadeAllowed(price, policy)) {
      throw new PublicError(
        `This side costs ${cents(price)} now. Contra only fades between ${cents(policy.minFadePrice)} and ${cents(policy.maxFadePrice)}.`,
        409,
        "outside_policy",
      );
    }

    const order = await createOrder(body);
    // Never pass along a transaction that needs anyone's signature but the user's own.
    assertOnlySigner(decodeTx(order.transaction), body.ownerPubkey);

    return json({ order, price });
  } catch (err) {
    return errorResponse(err);
  }
}
