import { errorResponse, json, rateLimit } from "@/lib/http";
import { getOrderStatus } from "@/lib/jupiter";
import { SolanaPubkey } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** GET /api/orders/:orderPubkey -> { status: "pending" | "filled" | "failed" | ... } */
export async function GET(req: Request, ctx: { params: Promise<{ order: string }> }) {
  try {
    rateLimit(req, "order-status", 60, 60_000);
    const order = SolanaPubkey.parse((await ctx.params).order);
    return json({ status: await getOrderStatus(order) });
  } catch (err) {
    return errorResponse(err);
  }
}
