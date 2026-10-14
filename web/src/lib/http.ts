import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { PublicError } from "./errors";

export { PublicError };

export function json(data: unknown, status = 200): NextResponse {
  return NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

/** Turn any thrown value into a response without leaking internals. */
export function errorResponse(err: unknown): NextResponse {
  if (err instanceof PublicError) {
    return json({ error: { code: err.code, message: err.message } }, err.status);
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const where = first?.path.length ? `${first.path.join(".")}: ` : "";
    return json({ error: { code: "invalid_request", message: `${where}${first?.message ?? "invalid input"}` } }, 400);
  }
  console.error("Unhandled API error", err);
  return json({ error: { code: "internal", message: "Something went wrong. Nothing was sent to the chain." } }, 500);
}

/**
 * Reject cross-site POSTs. Browsers always send Origin on cross-origin POSTs,
 * so a mismatch means another site is trying to drive this API.
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return; // non-browser clients (curl, server-to-server) carry no ambient credentials anyway
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new PublicError("Bad origin.", 403, "bad_origin");
  }
  if (!host || originHost !== host) {
    throw new PublicError("Cross-site requests are not allowed.", 403, "bad_origin");
  }
}

/** Read a JSON body with a hard size cap. */
export async function readJson(req: Request, maxBytes = 4096): Promise<unknown> {
  const text = await req.text();
  if (text.length > maxBytes) throw new PublicError("Request too large.", 413, "too_large");
  try {
    return JSON.parse(text);
  } catch {
    throw new PublicError("Body must be JSON.", 400, "invalid_json");
  }
}

// Best-effort per-instance rate limit. Serverless instances don't share memory,
// so this blunts bursts from one client rather than enforcing a global quota;
// upstream APIs enforce their own limits too.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(req: Request, key: string, limit: number, windowMs: number): void {
  const ip =
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const id = `${key}:${ip}`;
  const now = Date.now();
  const b = buckets.get(id);
  if (!b || b.resetAt <= now) {
    buckets.set(id, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) {
      for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    }
    return;
  }
  b.count += 1;
  if (b.count > limit) throw new PublicError("Too many requests. Try again in a minute.", 429, "rate_limited");
}
