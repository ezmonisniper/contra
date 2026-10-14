import "server-only";
import { z } from "zod";
import { env } from "./env";
import { PublicError } from "./errors";

/*
 * Jupiter Prediction API (beta): https://developers.jup.ag/docs/guides/how-to-build-a-prediction-market-app-on-solana
 * Orders and claims come back as UNSIGNED transactions; the user's wallet signs them.
 * Contra never holds funds or keys.
 *
 * The API is in beta and some units are not pinned down in its docs, so every
 * response is validated loosely and numbers are normalized defensively below.
 */

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const TIMEOUT_MS = 8000;

async function jup<T>(path: string, schema: z.ZodType<T>, init: RequestInit = {}): Promise<T> {
  const { JUPITER_API_KEY, JUPITER_PREDICTION_API_URL } = env();
  if (!JUPITER_API_KEY) {
    throw new PublicError("Trading isn't switched on yet on this deployment.", 503, "trading_disabled");
  }
  let res: Response;
  try {
    res = await fetch(`${JUPITER_PREDICTION_API_URL}${path}`, {
      ...init,
      headers: {
        accept: "application/json",
        "content-type": "application/json",
        "x-api-key": JUPITER_API_KEY,
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: "no-store",
    });
  } catch {
    throw new PublicError("The trading service didn't respond. Nothing was sent.", 504, "upstream_timeout");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    throw new PublicError(upstreamMessage(res.status, body), res.status === 404 ? 404 : 502, "upstream_error");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    console.error("Unexpected Jupiter response", path, parsed.error.issues.slice(0, 3));
    throw new PublicError("The trading service sent something unexpected. Nothing was sent.", 502, "upstream_shape");
  }
  return parsed.data;
}

function upstreamMessage(status: number, body: unknown): string {
  // Surface the upstream reason (often eligibility or a closed market) but keep it short and plain.
  const raw =
    body && typeof body === "object"
      ? ((body as Record<string, unknown>).message ?? (body as Record<string, unknown>).error)
      : undefined;
  const msg = typeof raw === "string" ? raw.replace(/[^\x20-\x7E]/g, "").slice(0, 160) : "";
  if (status === 403 || status === 451) return msg || "This market isn't available to your wallet or region.";
  if (status === 404) return msg || "Market not found.";
  if (status === 429) return "The trading service is busy. Try again in a moment.";
  return msg || "The trading service returned an error. Nothing was sent.";
}

/** Prices arrive either as dollars (0.91) or micro-USD (910000). Return dollars in (0,1) or null. */
export function normalizePrice(v: unknown): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  const d = n >= 1 ? n / 1_000_000 : n;
  return d > 0 && d < 1 ? d : null;
}

/** USD amounts in responses may be dollars or micro-USD. `ref` is a dollar figure of the same scale. */
export function normalizeUsd(v: unknown, ref: number): number | null {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n) || n < 0) return null;
  return n > ref * 5 + 5 ? n / 1_000_000 : n;
}

// ---- schemas (loose: unknown extra fields are fine) ----

const Pricing = z.looseObject({
  buyYesPriceUsd: z.unknown().optional(),
  buyNoPriceUsd: z.unknown().optional(),
  sellYesPriceUsd: z.unknown().optional(),
  sellNoPriceUsd: z.unknown().optional(),
});

const Market = z.looseObject({
  marketId: z.string(),
  status: z.string().optional(),
  result: z.string().nullable().optional(),
  closeTime: z.unknown().optional(),
  pricing: Pricing.optional(),
  metadata: z.looseObject({ title: z.string().optional() }).optional(),
});

const Event = z.looseObject({
  eventId: z.string(),
  isActive: z.boolean().optional(),
  metadata: z.looseObject({ title: z.string().optional(), slug: z.string().optional() }).optional(),
  markets: z.array(Market).optional(),
});

const ListOf = <T extends z.ZodType>(item: T) =>
  z.union([z.array(item), z.looseObject({ data: z.array(item) })]).transform((v) => (Array.isArray(v) ? v : v.data));

const OrderResponse = z.looseObject({
  transaction: z.string().min(1),
  txMeta: z.looseObject({ blockhash: z.string().optional(), lastValidBlockHeight: z.number().optional() }).optional(),
  order: z.looseObject({
    orderPubkey: z.string(),
    positionPubkey: z.string().optional(),
    contracts: z.unknown().optional(),
    orderCostUsd: z.unknown().optional(),
    estimatedTotalFeeUsd: z.unknown().optional(),
  }),
});

const OrderStatus = z.looseObject({ status: z.string() });

const Position = z.looseObject({
  pubkey: z.string(),
  marketId: z.string(),
  isYes: z.boolean(),
  contracts: z.unknown().optional(),
  avgPriceUsd: z.unknown().optional(),
  totalCostUsd: z.unknown().optional(),
  valueUsd: z.unknown().optional(),
  pnlUsd: z.unknown().optional(),
  pnlUsdAfterFees: z.unknown().optional(),
  claimable: z.boolean().optional(),
  claimed: z.boolean().optional(),
  payoutUsd: z.unknown().optional(),
  settlementDate: z.unknown().optional(),
});

const ClaimResponse = z.looseObject({ transaction: z.string().min(1) });

// ---- public API ----

export type ResolvedMarket = {
  marketId: string;
  title: string;
  status: string;
  buyYes: number | null;
  buyNo: number | null;
};

function normTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toResolved(m: z.infer<typeof Market>, fallbackTitle: string): ResolvedMarket {
  return {
    marketId: m.marketId,
    title: m.metadata?.title ?? fallbackTitle,
    status: m.status ?? "unknown",
    buyYes: normalizePrice(m.pricing?.buyYesPriceUsd),
    buyNo: normalizePrice(m.pricing?.buyNoPriceUsd),
  };
}

/**
 * Find the Jupiter market for a Polymarket question. Only an exact (normalized)
 * title match counts: fading the wrong market would be worse than not fading.
 */
export async function resolveMarket(question: string): Promise<ResolvedMarket | null> {
  const target = normTitle(question);
  const events = await jup(`/events/search?query=${encodeURIComponent(question.slice(0, 200))}&limit=10`, ListOf(Event));
  for (const ev of events.slice(0, 5)) {
    const evTitle = ev.metadata?.title ?? "";
    const markets = ev.markets ?? (await jup(`/events/${encodeURIComponent(ev.eventId)}`, Event)).markets ?? [];
    const exact = markets.find((m) => m.metadata?.title && normTitle(m.metadata.title) === target);
    if (exact) return toResolved(exact, evTitle);
    if (normTitle(evTitle) === target && markets.length === 1) return toResolved(markets[0]!, evTitle);
  }
  return null;
}

export async function getMarket(marketId: string): Promise<ResolvedMarket> {
  const m = await jup(`/markets/${encodeURIComponent(marketId)}`, Market);
  return toResolved(m, "");
}

export type CreatedOrder = {
  transaction: string;
  orderPubkey: string;
  lastValidBlockHeight: number | null;
  contracts: number | null;
  costUsd: number | null;
  feeUsd: number | null;
};

export async function createOrder(input: {
  ownerPubkey: string;
  marketId: string;
  isYes: boolean;
  amountUsd: number;
}): Promise<CreatedOrder> {
  const r = await jup("/orders", OrderResponse, {
    method: "POST",
    body: JSON.stringify({
      ownerPubkey: input.ownerPubkey,
      marketId: input.marketId,
      isYes: input.isYes,
      isBuy: true,
      depositAmount: String(Math.round(input.amountUsd * 1_000_000)),
      depositMint: USDC_MINT,
    }),
  });
  const contracts = Number(r.order.contracts);
  return {
    transaction: r.transaction,
    orderPubkey: r.order.orderPubkey,
    lastValidBlockHeight: r.txMeta?.lastValidBlockHeight ?? null,
    contracts: Number.isFinite(contracts) ? contracts : null,
    costUsd: normalizeUsd(r.order.orderCostUsd, input.amountUsd),
    feeUsd: normalizeUsd(r.order.estimatedTotalFeeUsd, input.amountUsd),
  };
}

export async function getOrderStatus(orderPubkey: string): Promise<string> {
  const r = await jup(`/orders/status/${encodeURIComponent(orderPubkey)}`, OrderStatus);
  return r.status;
}

export type PositionView = {
  pubkey: string;
  marketId: string;
  isYes: boolean;
  contracts: number | null;
  avgPrice: number | null;
  costUsd: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  claimable: boolean;
  claimed: boolean;
};

export async function getPositions(ownerPubkey: string): Promise<PositionView[]> {
  const list = await jup(`/positions?ownerPubkey=${encodeURIComponent(ownerPubkey)}`, ListOf(Position));
  return list.slice(0, 200).map((p) => {
    const contracts = Number(p.contracts);
    const ref = Number.isFinite(contracts) ? Math.max(contracts, 1) : 1000;
    return {
      pubkey: p.pubkey,
      marketId: p.marketId,
      isYes: p.isYes,
      contracts: Number.isFinite(contracts) ? contracts : null,
      avgPrice: normalizePrice(p.avgPriceUsd),
      costUsd: normalizeUsd(p.totalCostUsd, ref),
      valueUsd: normalizeUsd(p.valueUsd, ref),
      pnlUsd: (() => {
        const v = Number(p.pnlUsdAfterFees ?? p.pnlUsd);
        if (!Number.isFinite(v)) return null;
        return Math.abs(v) > ref * 5 + 5 ? v / 1_000_000 : v;
      })(),
      claimable: p.claimable === true,
      claimed: p.claimed === true,
    };
  });
}

export async function claimPosition(positionPubkey: string, ownerPubkey: string): Promise<string> {
  const r = await jup(`/positions/${encodeURIComponent(positionPubkey)}/claim`, ClaimResponse, {
    method: "POST",
    body: JSON.stringify({ ownerPubkey }),
  });
  return r.transaction;
}
