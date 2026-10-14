import "server-only";
import { z } from "zod";

/**
 * Server-only configuration. Nothing here ever reaches the browser: the keys
 * stay on the server and every client request goes through our API routes.
 */
const EnvSchema = z.object({
  JUPITER_API_KEY: z.string().min(1).optional(),
  JUPITER_PREDICTION_API_URL: z.url().default("https://api.jup.ag/prediction/v1"),
  SOLANA_RPC_URL: z.url().optional(),
  /** Largest single fade, in USD. Enforced on the server, not just the UI. */
  CONTRA_MAX_FADE_USD: z.coerce.number().positive().max(10_000).default(100),
  /** Optional allow-list: when set, the relay only forwards transactions that call this program. */
  JUPITER_PREDICTION_PROGRAM_ID: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | undefined;

export function env(): Env {
  cached ??= EnvSchema.parse({
    JUPITER_API_KEY: process.env.JUPITER_API_KEY || undefined,
    JUPITER_PREDICTION_API_URL: process.env.JUPITER_PREDICTION_API_URL || undefined,
    SOLANA_RPC_URL: process.env.SOLANA_RPC_URL || undefined,
    CONTRA_MAX_FADE_USD: process.env.CONTRA_MAX_FADE_USD || undefined,
    JUPITER_PREDICTION_PROGRAM_ID: process.env.JUPITER_PREDICTION_PROGRAM_ID || undefined,
  });
  return cached;
}

/** For tests. */
export function resetEnvCache(): void {
  cached = undefined;
}
