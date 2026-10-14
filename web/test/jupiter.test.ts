import { describe, expect, it } from "vitest";
import { normalizePrice, normalizeUsd } from "@/lib/jupiter";

describe("upstream number normalization", () => {
  it("reads prices given in dollars or micro-USD", () => {
    expect(normalizePrice(0.91)).toBe(0.91);
    expect(normalizePrice("0.5")).toBe(0.5);
    expect(normalizePrice(910000)).toBeCloseTo(0.91);
    expect(normalizePrice("120000")).toBeCloseTo(0.12);
  });

  it("rejects prices that can't be a probability", () => {
    expect(normalizePrice(0)).toBeNull();
    expect(normalizePrice(-1)).toBeNull();
    expect(normalizePrice(1_000_000)).toBeNull();
    expect(normalizePrice("abc")).toBeNull();
    expect(normalizePrice(undefined)).toBeNull();
  });

  it("reads USD amounts in either scale relative to the order size", () => {
    expect(normalizeUsd(0.12, 10)).toBe(0.12);
    expect(normalizeUsd(120000, 10)).toBeCloseTo(0.12);
    expect(normalizeUsd(10_000_000, 10)).toBe(10);
    expect(normalizeUsd(-1, 10)).toBeNull();
  });
});
