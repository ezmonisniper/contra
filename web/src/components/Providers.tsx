"use client";

import { WalletProvider } from "@solana/wallet-adapter-react";
import type { ReactNode } from "react";

/**
 * Wallets are discovered through the Wallet Standard (Phantom, Solflare,
 * Backpack and others announce themselves), so no wallet-specific code ships.
 * Contra only ever asks a wallet to sign; it never asks for or stores keys.
 */
export function Providers({ children }: { children: ReactNode }) {
  return (
    <WalletProvider wallets={[]} autoConnect onError={(e) => console.warn("Wallet:", e.name)}>
      {children}
    </WalletProvider>
  );
}
