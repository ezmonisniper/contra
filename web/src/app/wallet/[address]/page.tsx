import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Outcome, SampleNotice, SigmaBadge } from "@/components/bits";
import { FadeButton } from "@/components/fade/FadeButton";
import ui from "@/components/ui.module.css";
import { getFadeList, getWallet } from "@/lib/data";
import { AddressSchema } from "@/lib/fade-list";
import { cents, shortAddress, shortDate, signedPercent } from "@/lib/format";
import styles from "./page.module.css";

type Props = { params: Promise<{ address: string }> };

async function load(props: Props) {
  const { address } = await props.params;
  if (!AddressSchema.safeParse(address).success) notFound();
  const wallet = getWallet(address);
  if (!wallet) notFound();
  return wallet;
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const w = await load(props);
  const title = `${shortAddress(w.address)} lost ${w.confLosses} of ${w.confBets} sure bets`;
  return {
    title,
    description: `${w.confBets} bets at ${cents(getFadeList().confidencePrice)} or higher. The odds expected ${Math.round(w.expectedConfLosses)} losses.`,
  };
}

export default async function WalletPage(props: Props) {
  const w = await load(props);
  const list = getFadeList();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const shareText = `${shortAddress(w.address)} lost ${w.confLosses} of ${w.confBets} bets it was at least ${Math.round(list.confidencePrice * 100)}% sure about. The odds said ${Math.round(w.expectedConfLosses)}.`;
  const shareUrl = `https://x.com/intent/post?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(`${siteUrl}/wallet/${w.address}`)}`;

  return (
    <div className={ui.container}>
      <section className={`${ui.stack} ${styles.top}`}>
        <Link href="/" className={ui.caption}>
          ← Fade List
        </Link>
        <p className={styles.address}>{w.address}</p>
        <h1 className={`${ui.title} ${styles.headline}`}>
          Lost {w.confLosses} of {w.confBets} bets it was at least {Math.round(list.confidencePrice * 100)}% sure
          about.
        </h1>
        <SampleNotice show={list.sample} />
      </section>

      <section aria-label="Record" className={`${ui.grid} ${styles.statRow}`}>
        <div className={`${ui.card} ${styles.stat}`}>
          <span className={ui.eyebrow}>σ score</span>
          <span>
            <SigmaBadge value={w.sigma} />
          </span>
          <span className={ui.caption}>How far results fall below the odds</span>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <span className={ui.eyebrow}>Losses the odds expected</span>
          <span className={ui.figureLg}>{Math.round(w.expectedConfLosses)}</span>
          <span className={ui.caption}>Actual: {w.confLosses}</span>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <span className={ui.eyebrow}>Return on all bets</span>
          <span className={`${ui.figureLg} ${w.roi >= 0 ? ui.gain : ui.loss}`}>{signedPercent(w.roi)}</span>
          <span className={ui.caption}>
            {w.resolvedBets} resolved bets in {w.markets} markets
          </span>
        </div>
      </section>

      <section className={`${ui.stack} ${styles.section}`} aria-labelledby="open-bets">
        <h2 id="open-bets" className={ui.heading}>
          Open bets you can fade
        </h2>
        {w.openBets.length === 0 ? (
          <p className={ui.muted}>No open bets right now. Check back after the next update.</p>
        ) : (
          <div className={styles.bets}>
            {w.openBets.map((b) => (
              <div key={b.conditionId + b.outcomeIndex} className={`${ui.card} ${styles.bet}`}>
                <div className={styles.betText}>
                  <span>{b.question}</span>
                  <span className={ui.caption}>
                    Bought {b.outcome} at <span className={ui.mono}>{cents(b.price)}</span> · {shortDate(b.placedAt)}
                  </span>
                </div>
                <FadeButton bet={b} policy={list.policy} sample={list.sample} />
              </div>
            ))}
          </div>
        )}
      </section>

      {w.worstCall && (
        <section className={styles.section}>
          <p className={styles.worst}>
            <strong>Worst call:</strong> bought {w.worstCall.outcome} at{" "}
            <span className={ui.figure}>{cents(w.worstCall.price)}</span> on “{w.worstCall.question}” It resolved{" "}
            {w.worstCall.otherOutcome}.
          </p>
        </section>
      )}

      {w.recent.length > 0 && (
        <section className={styles.section}>
          <div className={ui.tableWrap}>
            <table className={ui.table}>
              <caption>Recent resolved bets</caption>
              <thead>
                <tr>
                  <th scope="col">Market</th>
                  <th scope="col">Bought</th>
                  <th scope="col" className={ui.right}>
                    Price
                  </th>
                  <th scope="col">Result</th>
                  <th scope="col">Resolved</th>
                </tr>
              </thead>
              <tbody>
                {w.recent.map((r, i) => (
                  <tr key={i}>
                    <td>{r.question}</td>
                    <td>{r.outcome}</td>
                    <td className={`${ui.right} ${ui.mono}`}>{cents(r.price)}</td>
                    <td>
                      <Outcome won={r.won} />
                    </td>
                    <td className={ui.caption}>{shortDate(r.resolvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.share}>
        <a className={ui.secondary} href={shareUrl} target="_blank" rel="noopener noreferrer">
          Share on X
        </a>
      </section>
    </div>
  );
}
