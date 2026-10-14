import { z } from "zod";
import { assertSameOrigin, errorResponse, json, rateLimit, readJson } from "@/lib/http";
import { claimPosition } from "@/lib/jupiter";
import { assertOnlySigner, decodeTx } from "@/lib/tx";
import { SolanaPubkey } from "@/lib/validate";

export const dynamic = "force-dynamic";

/** POST /api/positions/:position/claim { ownerPubkey } -> UNSIGNED payout transaction for the user to sign. */
export async function POST(req: Request, ctx: { params: Promise<{ position: string }> }) {
  try {
    assertSameOrigin(req);
    rateLimit(req, "claim", 10, 60_000);
    const position = SolanaPubkey.parse((await ctx.params).position);
    const { ownerPubkey } = z.object({ ownerPubkey: SolanaPubkey }).strict().parse(await readJson(req));
    const transaction = await claimPosition(position, ownerPubkey);
    assertOnlySigner(decodeTx(transaction), ownerPubkey);
    return json({ transaction });
  } catch (err) {
    return errorResponse(err);
  }
}
