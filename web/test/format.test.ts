import { describe, expect, it } from "vitest";
import { cents, shortAddress, sigma, signedPercent, usd } from "@/lib/format";

describe("format", () => {
  it("formats prices in cents, clamped to 1-99", () => {
    expect(cents(0.91)).toBe("91¢");
    expect(cents(0.004)).toBe("1¢");
    expect(cents(0.999)).toBe("99¢");
  });

  it("uses a true minus sign, never a hyphen", () => {
    expect(signedPercent(-0.31)).toBe("−31.0%");
    expect(signedPercent(0.061)).toBe("+6.1%");
    expect(signedPercent(0)).toBe("0.0%");
    expect(sigma(-3.42)).toBe("−3.4σ");
    expect(usd(-12.5, { signed: true })).toBe("−$12.50");
    expect(usd(1234.5)).toBe("$1,234.50");
  });

  it("shortens addresses", () => {
    expect(shortAddress("0x01decb5d53df10257f77f58a6fc83af19283f82b")).toBe("0x01de…f82b");
    expect(shortAddress("7xKpQ2wLaBq9TxV7e5nWdHc31Pz2Lk8QmUb4N")).toBe("7xKp…Ub4N");
  });
});
