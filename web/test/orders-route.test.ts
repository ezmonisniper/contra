import { Keypair } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/orders/route";
import { resetEnvCache } from "@/lib/env";
import { bytesToB64 } from "@/lib/tx";
import { makeTx } from "./helpers";

const owner = Keypair.generate();

function req(body: unknown, origin = "https://contra.example") {
  return new Request("https://contra.example/api/orders", {
    method: "POST",
    headers: { "content-type": "application/json", origin, "x-forwarded-host": "contra.example", "x-real-ip": crypto.randomUUID() },
    body: JSON.stringify(body),
  });
}

const good = { ownerPubkey: owner.publicKey.toBase58(), marketId: "mkt_123", isYes: false, amountUsd: 10 };

/** Fake Jupiter: a market priced at `noPrice`, and an order whose transaction is paid by `payer`. */
function mockJupiter(noPrice: number, payer: Keypair = owner) {
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/markets/")) {
      return Response.json({ marketId: "mkt_123", status: "open", pricing: { buyYesPriceUsd: 1 - noPrice, buyNoPriceUsd: noPrice } });
    }
    if (u.endsWith("/orders") && init?.method === "POST") {
      return Response.json({
        transaction: bytesToB64(makeTx(payer).serialize()),
        txMeta: { blockhash: "x", lastValidBlockHeight: 1 },
        order: { orderPubkey: Keypair.generate().publicKey.toBase58(), contracts: 13, orderCostUsd: 9.9, estimatedTotalFeeUsd: 0.1 },
      });
    }
    return new Response("not found", { status: 404 });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => {
  process.env.JUPITER_API_KEY = "test-key";
  process.env.CONTRA_MAX_FADE_USD = "100";
  resetEnvCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/orders", () => {
  it("returns an unsigned order the owner alone can sign", async () => {
    const f = mockJupiter(0.74);
    const res = await POST(req(good));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.order.transaction).toBeTypeOf("string");
    expect(body.price).toBeCloseTo(0.74);
    // the API key is sent upstream and never echoed back
    const init = f.mock.calls.find((c) => String(c[0]).endsWith("/orders"))![1]!;
    expect((init.headers as Record<string, string>)["x-api-key"]).toBe("test-key");
    expect(JSON.stringify(body)).not.toContain("test-key");
    expect(JSON.parse(String(init.body)).depositAmount).toBe("10000000");
  });

  it("refuses amounts over the server cap", async () => {
    mockJupiter(0.74);
    const res = await POST(req({ ...good, amountUsd: 5000 }));
    expect(res.status).toBe(400);
  });

  it("refuses fades into long shots, whatever the page says", async () => {
    mockJupiter(0.12);
    const res = await POST(req(good));
    expect(res.status).toBe(409);
    expect((await res.json()).error.code).toBe("outside_policy");
  });

  it("refuses to pass on a transaction someone else pays for", async () => {
    mockJupiter(0.74, Keypair.generate());
    const res = await POST(req(good));
    expect(res.status).toBe(502);
    expect((await res.json()).error.code).toBe("fee_payer_mismatch");
  });

  it("blocks cross-site requests", async () => {
    mockJupiter(0.74);
    const res = await POST(req(good, "https://evil.example"));
    expect(res.status).toBe(403);
  });

  it("rejects unknown fields and bad addresses", async () => {
    mockJupiter(0.74);
    expect((await POST(req({ ...good, extra: 1 }))).status).toBe(400);
    expect((await POST(req({ ...good, ownerPubkey: "0xabc" }))).status).toBe(400);
    expect((await POST(req({ ...good, marketId: "../../admin" }))).status).toBe(400);
  });

  it("says trading is off when no API key is configured", async () => {
    delete process.env.JUPITER_API_KEY;
    resetEnvCache();
    mockJupiter(0.74);
    const res = await POST(req(good));
    expect(res.status).toBe(503);
  });
});
