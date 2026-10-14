import Link from "next/link";
import { SampleNotice, SigmaBadge } from "@/components/bits";
import ui from "@/components/ui.module.css";
import { getFadeList } from "@/lib/data";
import { cents, shortAddress, shortDate, signedPercent } from "@/lib/format";
import styles from "./page.module.css";

export default function FadeListPage() {
  const list = getFadeList();
  const { stats } = list;
  const bt = stats.backtest;

  return (
    <div className={ui.container}>
      <section className={`${ui.stack} ${styles.hero}`}>
        <p className={ui.eyebrow}>
          Fade List · updated {shortDate(list.generatedAt)} · Polymarket wallets, traded from Solana
        </p>
        <h1 className={ui.display}>Bet against the worst.</h1>
        <p className={ui.lede}>
          Wallets that keep losing bets they were sure about, ranked by how far their results fall below the odds.
          Open one to see its live bets and take the other side.
        </p>
        <SampleNotice show={list.sample} />
      </section>

      <section aria-label="This list" className={`${ui.grid} ${styles.stats}`}>
        <div className={`${ui.card} ${styles.stat}`}>
          <span className={ui.eyebrow}>Wallets scored</span>
          <span className={ui.figureLg}>{stats.walletsTracked?.toLocaleString("en-US") ?? "–"}</span>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <span className={ui.eyebrow}>On the list</span>
          <span className={ui.figureLg}>{stats.flagged?.toLocaleString("en-US") ?? list.wallets.length}</span>
          <span className={ui.caption}>−2σ or worse over 20+ resolved bets</span>
        </div>
        <div className={`${ui.card} ${styles.stat}`}>
          <span className={ui.eyebrow}>Fading the list, backtest</span>
          {bt ? (
            <>
              <span className={`${ui.figureLg} ${bt.roi >= 0 ? ui.gain : ui.loss}`}>{signedPercent(bt.roi)}</span>
              <span className={ui.caption}>
                After costs · {bt.fades.toLocaleString("en-US")} fades over {Math.round(bt.days)} days · 95% range{" "}
                {signedPercent(bt.ciLow)} to {signedPercent(bt.ciHigh)}
              </span>
            </>
          ) : (
            <>
              <span className={ui.figureLg}>Pending</span>
              <span className={ui.caption}>Published once the full-year backtest is in</span>
            </>
          )}
        </div>
      </section>

      <div className={ui.tableWrap}>
        <table className={ui.table}>
          <caption>Most confidently wrong, last {list.windowDays} days</caption>
          <thead>
            <tr>
              <th scope="col">#</th>
              <th scope="col">Wallet</th>
              <th scope="col">σ score</th>
              <th scope="col">Bets at {cents(list.confidencePrice)} or higher</th>
              <th scope="col" className={ui.right}>
                Resolved
              </th>
              <th scope="col" className={ui.right}>
                Open bets
              </th>
            </tr>
          </thead>
          <tbody>
            {list.wallets.length === 0 && (
              <tr>
                <td colSpan={6} className={styles.empty}>
                  No wallet qualifies this week.
                </td>
              </tr>
            )}
            {list.wallets.map((w, i) => (
              <tr key={w.address}>
                <td className={`${ui.mono} ${ui.muted}`}>{i + 1}</td>
                <td>
                  <span className={styles.walletCell}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark */}
                    <img src="/brand/contra-mark.svg" alt="" width={20} height={20} />
                    <Link className={styles.walletLink} href={`/wallet/${w.address}`}>
                      {shortAddress(w.address)}
                    </Link>
                  </span>
                </td>
                <td>
                  <SigmaBadge value={w.sigma} />
                </td>
                <td>
                  <span className={styles.twoLine}>
                    <span>
                      Lost {w.confLosses} of {w.confBets}
                    </span>
                    <span className={ui.caption}>The odds said {Math.round(w.expectedConfLosses)}</span>
                  </span>
                </td>
                <td className={`${ui.right} ${ui.mono}`}>{w.resolvedBets}</td>
                <td className={ui.right}>
                  {w.openBets.length > 0 ? (
                    <Link className={ui.secondary} href={`/wallet/${w.address}`}>
                      {w.openBets.length} to fade
                    </Link>
                  ) : (
                    <span className={ui.caption}>None right now</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className={`${ui.grid} ${styles.explain}`}>
        <div className={`${ui.card} ${ui.stack}`}>
          <h2 className={ui.heading}>How the σ score works</h2>
          <p className={ui.muted}>
            Every pick is compared with its price at the time. A bet bought at 80¢ should win about 80% of the time.
            The σ score measures how far a wallet&apos;s results fall below what the odds promised, in standard
            deviations. <Link href="/how-it-works">More on the method</Link>
          </p>
        </div>
        <div className={`${ui.card} ${ui.stack}`}>
          <h2 className={ui.heading}>Wallets, not people</h2>
          <p className={ui.muted}>
            We show addresses only and never link a wallet to a person. Wallets with fewer than 20 resolved bets are
            never listed, because small samples are luck. Own a wallet here? <Link href="/legal#removal">Ask to be
            removed.</Link>
          </p>
        </div>
      </section>
    </div>
  );
}
