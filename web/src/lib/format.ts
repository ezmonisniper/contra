/** True minus sign, per the brand book. Never a hyphen in numbers. */
export const MINUS = "−";

/** 0.91 -> "91¢". Prices under 1¢ or above 99¢ are clamped for display. */
export function cents(price: number): string {
  const c = Math.round(price * 100);
  return `${Math.min(99, Math.max(1, c))}¢`;
}

/** 0.061 -> "+6.1%", -0.31 -> "−31.0%". */
export function signedPercent(x: number, digits = 1): string {
  const v = x * 100;
  const s = Math.abs(v).toFixed(digits);
  if (Number(s) === 0) return `${s}%`;
  return `${v > 0 ? "+" : MINUS}${s}%`;
}

/** -3.4 -> "−3.4σ". */
export function sigma(x: number): string {
  const s = Math.abs(x).toFixed(1);
  if (Number(s) === 0) return "0.0σ";
  return `${x > 0 ? "+" : MINUS}${s}σ`;
}

/** 12.5 -> "$12.50"; signed when asked. */
export function usd(x: number, opts: { signed?: boolean } = {}): string {
  const s = Math.abs(x).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (!opts.signed || Number(s.replace(/,/g, "")) === 0) return `$${s}`;
  return `${x > 0 ? "+" : MINUS}$${s}`;
}

/** "0x3c58ef42...a1b2" -> "0x3c58…a1b2"; base58 keeps 4+4. */
export function shortAddress(address: string): string {
  if (address.startsWith("0x")) return `${address.slice(0, 6)}…${address.slice(-4)}`;
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

/** ISO date -> "Oct 13, 2026" in UTC so server and browser agree. */
export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
