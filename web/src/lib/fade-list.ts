import { z } from "zod";

/** A Polymarket proxy wallet (Polygon) or a Solana wallet. */
export const AddressSchema = z
  .string()
  .regex(/^(0x[0-9a-fA-F]{40}|[1-9A-HJ-NP-Za-km-z]{32,44})$/, "not a wallet address");

const IsoDate = z.iso.datetime({ offset: true });
const Price = z.number().gt(0).lt(1);

const BetBase = z.object({
  question: z.string().min(1).max(300),
  /** The outcome the wallet bought, as the market names it ("Yes", "No", a team...). */
  outcome: z.string().min(1).max(80),
  /** 0 = the market's first outcome (YES), 1 = the second (NO). */
  outcomeIndex: z.union([z.literal(0), z.literal(1)]),
  /** The other outcome: the one a fade buys. */
  otherOutcome: z.string().min(1).max(80),
  /** Price the wallet paid per share, 0-1. */
  price: Price,
});

export const ResolvedBetSchema = BetBase.extend({
  won: z.boolean(),
  resolvedAt: IsoDate,
});

export const OpenBetSchema = BetBase.extend({
  placedAt: IsoDate,
  conditionId: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  slug: z.string().max(200),
});

export const WalletSchema = z.object({
  address: AddressSchema,
  /** Standard deviations above (+) or below (-) what the odds implied. */
  sigma: z.number(),
  resolvedBets: z.number().int().nonnegative(),
  markets: z.number().int().nonnegative(),
  /** Bets placed at or above the confidence price (80c). */
  confBets: z.number().int().nonnegative(),
  confLosses: z.number().int().nonnegative(),
  expectedConfLosses: z.number().nonnegative(),
  /** Return per dollar staked, held to resolution. */
  roi: z.number(),
  worstCall: ResolvedBetSchema.nullable(),
  recent: z.array(ResolvedBetSchema).max(20),
  openBets: z.array(OpenBetSchema).max(20),
});

export const FadeListSchema = z.object({
  generatedAt: IsoDate,
  /** True while the list is illustrative. Every page says so while it is. */
  sample: z.boolean(),
  windowDays: z.number().int().positive(),
  confidencePrice: Price,
  stats: z.object({
    walletsTracked: z.number().int().nonnegative().nullable(),
    flagged: z.number().int().nonnegative().nullable(),
    backtest: z
      .object({
        roi: z.number(),
        ciLow: z.number(),
        ciHigh: z.number(),
        fades: z.number().int().positive(),
        days: z.number().positive(),
      })
      .nullable(),
  }),
  /** Contra only offers a fade when the side you'd buy is priced inside this band. */
  policy: z
    .object({
      minFadePrice: Price,
      maxFadePrice: Price,
    })
    .refine((p) => p.minFadePrice < p.maxFadePrice, "minFadePrice must be below maxFadePrice"),
  wallets: z.array(WalletSchema).max(500),
});

export type ResolvedBet = z.infer<typeof ResolvedBetSchema>;
export type OpenBet = z.infer<typeof OpenBetSchema>;
export type Wallet = z.infer<typeof WalletSchema>;
export type FadeList = z.infer<typeof FadeListSchema>;
export type FadePolicy = FadeList["policy"];

/** Whether Contra will offer a fade at this price for the side you'd buy. */
export function fadeAllowed(fadeSidePrice: number, policy: FadePolicy): boolean {
  return fadeSidePrice >= policy.minFadePrice && fadeSidePrice <= policy.maxFadePrice;
}
