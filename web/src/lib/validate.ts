import { PublicKey } from "@solana/web3.js";
import { z } from "zod";

/** A Solana public key: base58, decodes to exactly 32 bytes. */
export const SolanaPubkey = z
  .string()
  .regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/, "not a Solana address")
  .refine((s) => {
    try {
      return new PublicKey(s).toBytes().length === 32;
    } catch {
      return false;
    }
  }, "not a Solana address");

/** Ids the upstream API hands out. Conservative charset, no path tricks. */
export const UpstreamId = z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "invalid id");

/** USD amount for one fade: at least $1, at most `max`, cents precision. */
export function fadeAmount(max: number) {
  return z
    .number()
    .finite()
    .min(1, "Minimum fade is $1.")
    .max(max, `Maximum fade is $${max}.`)
    .refine((n) => Math.round(n * 100) === n * 100 || Math.abs(Math.round(n * 100) - n * 100) < 1e-6, "Use whole cents.");
}

export const MarketQuery = z.object({
  q: z.string().trim().min(3).max(300),
});
