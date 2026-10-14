import type { Metadata } from "next";
import Link from "next/link";
import ui from "@/components/ui.module.css";
import { getFadeList } from "@/lib/data";
import { cents } from "@/lib/format";
import styles from "../prose.module.css";

export const metadata: Metadata = { title: "How it works" };

export default function HowItWorks() {
  const { policy, confidencePrice, windowDays } = getFadeList();
  return (
    <article className={`${ui.container} ${styles.prose}`}>
      <p className={ui.eyebrow}>How it works</p>
      <h1 className={ui.title}>Finding the wallets that are confidently wrong</h1>

      <h2 className={ui.heading}>1. Score every pick against its odds</h2>
      <p>
        A prediction-market price is the crowd&apos;s probability. Buying YES at 80¢ is a bet that wins about 80% of the
        time. For every wallet we take its first buy in each market and compare what happened with what the price said
        should happen.
      </p>

      <h2 className={ui.heading}>2. The σ score</h2>
      <p>
        Add up how much worse (or better) each pick did than its price implied, and divide by how much that could vary
        by pure chance. The result is the σ score: how many standard deviations the wallet sits below the odds. Around
        0σ is normal luck. A wallet joins the Fade List at −2σ or worse, over at least 20 resolved bets in at least 10
        markets, judged on the last {windowDays} days.
      </p>
      <p>
        The headline number on each wallet is about bets placed at {cents(confidencePrice)} or higher: the ones it was
        most sure about. Losing many of those is the clearest sign of bad judgment, not bad luck.
      </p>

      <h2 className={ui.heading}>3. No hindsight</h2>
      <p>
        Our backtest only ever judges a wallet on markets that had already resolved before the moment it would have
        been faded. It also pays realistic prices: it waits a few seconds after their trade and pays the next price plus
        a spread. It compares every result against two controls: fading random wallets, and simply buying contracts at
        the same prices without following anyone.
      </p>

      <h2 className={ui.heading}>4. Why we only fade into favorites</h2>
      <p>
        Fading someone who bought a favorite means buying the long shot. Long shots are overpriced on prediction
        markets, and the spread eats a large share of a 10¢ contract. Our first tests found that buying long shots lost
        money even against bad traders. So Contra only offers a fade when the side you&apos;d buy costs between{" "}
        {cents(policy.minFadePrice)} and {cents(policy.maxFadePrice)}. This rule is enforced on our server, not just in
        the page.
      </p>

      <h2 className={ui.heading}>5. You sign every fade yourself</h2>
      <ol>
        <li>Connect a Solana wallet such as Phantom, Solflare or Backpack.</li>
        <li>Open a wallet on the list and choose one of its open bets.</li>
        <li>Contra finds the same market on Solana through Jupiter and shows the live price for the other side.</li>
        <li>You pick an amount (up to our per-fade cap) and confirm in your wallet.</li>
        <li>Your wallet signs; the order is filled on-chain; the position is yours. Winnings are claimed from My fades.</li>
      </ol>
      <p>
        Contra never holds your money, never sees your keys, and can&apos;t move funds without your signature. Every
        transaction is checked twice, on our server and in your browser, to make sure only your signature is needed
        before your wallet is even asked.
      </p>

      <h2 className={ui.heading}>The risks</h2>
      <p>
        Past results don&apos;t predict future ones. A wallet can be wrong for a while and then right. Markets can move
        before your order fills. You can lose the full amount of every fade. Read the{" "}
        <Link href="/legal">terms and risks</Link> before you trade.
      </p>
    </article>
  );
}
