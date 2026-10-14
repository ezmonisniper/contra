import { describe, expect, it } from "vitest";
import raw from "@/data/fade-list.json";
import { fadeAllowed, FadeListSchema } from "@/lib/fade-list";

describe("fade list data", () => {
  it("the shipped data file matches the schema", () => {
    expect(() => FadeListSchema.parse(raw)).not.toThrow();
  });

  it("rejects a list whose policy band is inverted", () => {
    const bad = { ...raw, policy: { minFadePrice: 0.9, maxFadePrice: 0.5 } };
    expect(FadeListSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects prices outside 0-1 and junk addresses", () => {
    const w = raw.wallets[0]!;
    expect(FadeListSchema.safeParse({ ...raw, wallets: [{ ...w, address: "not-an-address" }] }).success).toBe(false);
    expect(
      FadeListSchema.safeParse({ ...raw, wallets: [{ ...w, openBets: [{ ...w.openBets[0]!, price: 1.2 }] }] }).success,
    ).toBe(false);
  });

  it("only allows fades inside the policy band", () => {
    const policy = { minFadePrice: 0.5, maxFadePrice: 0.97 };
    expect(fadeAllowed(0.12, policy)).toBe(false);
    expect(fadeAllowed(0.5, policy)).toBe(true);
    expect(fadeAllowed(0.73, policy)).toBe(true);
    expect(fadeAllowed(0.98, policy)).toBe(false);
  });
});
