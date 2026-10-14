import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import type { Metadata, Viewport } from "next";
import { connection } from "next/server";
import type { ReactNode } from "react";
import { Providers } from "@/components/Providers";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "Contra: bet against the worst", template: "%s · Contra" },
  description:
    "Contra finds prediction-market wallets that keep losing bets they were sure about, and lets you take the other side.",
  openGraph: { siteName: "Contra", type: "website" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = { themeColor: "#f7f7f4" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Render per request so every page gets a fresh CSP nonce (see src/proxy.ts).
  await connection();
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <Providers>
          <SiteHeader />
          <main>{children}</main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
