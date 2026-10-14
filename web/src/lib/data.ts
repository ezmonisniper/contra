import "server-only";
import raw from "@/data/fade-list.json";
import { FadeListSchema, type FadeList, type Wallet } from "./fade-list";

// Parsed once per server instance. A malformed data file fails loudly at build time
// rather than rendering wrong numbers.
const parsed: FadeList = FadeListSchema.parse(raw);

const byAddress = new Map<string, Wallet>(parsed.wallets.map((w) => [w.address.toLowerCase(), w]));

export function getFadeList(): FadeList {
  return parsed;
}

export function getWallet(address: string): Wallet | undefined {
  return byAddress.get(address.toLowerCase());
}
