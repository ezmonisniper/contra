import { Connection } from "@solana/web3.js";
import { z } from "zod";
import { env } from "@/lib/env";
import { assertSameOrigin, errorResponse, json, PublicError, rateLimit, readJson } from "@/lib/http";
import { assertFullySigned, decodeTx, programIds } from "@/lib/tx";

export const dynamic = "force-dynamic";

/**
 * POST /api/transactions { transaction } -> { signature }
 * Relays a transaction the user ALREADY SIGNED in their wallet, so the RPC key stays on the server.
 * The server cannot change a signed transaction: any edit would invalidate the user's signature.
 */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    rateLimit(req, "send", 10, 60_000);
    const { SOLANA_RPC_URL, JUPITER_PREDICTION_PROGRAM_ID } = env();
    if (!SOLANA_RPC_URL) throw new PublicError("Trading isn't switched on yet on this deployment.", 503, "trading_disabled");

    const { transaction } = z.object({ transaction: z.string().max(2048) }).strict().parse(await readJson(req, 4096));
    const tx = decodeTx(transaction);
    assertFullySigned(tx);
    if (JUPITER_PREDICTION_PROGRAM_ID && !programIds(tx).includes(JUPITER_PREDICTION_PROGRAM_ID)) {
      throw new PublicError("This relay only forwards prediction-market transactions.", 400, "program_not_allowed");
    }

    const connection = new Connection(SOLANA_RPC_URL, "confirmed");
    let signature: string;
    try {
      signature = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 2 });
    } catch {
      throw new PublicError("The network rejected the transaction. Nothing was spent.", 502, "send_failed");
    }
    return json({ signature });
  } catch (err) {
    return errorResponse(err);
  }
}
