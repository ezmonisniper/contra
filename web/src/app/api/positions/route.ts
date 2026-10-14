import { errorResponse, json, rateLimit } from "@/lib/http";
import { getPositions } from "@/lib/jupiter";
import { SolanaPubkey } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** GET /api/positions?owner=<pubkey> -> the wallet's prediction-market positions. Public on-chain data. */
export async function GET(req: Request) {
  try {
    rateLimit(req, "positions", 30, 60_000);
    const owner = SolanaPubkey.parse(new URL(req.url).searchParams.get("owner") ?? "");
    return json({ positions: await getPositions(owner) });
  } catch (err) {
    return errorResponse(err);
  }
}
