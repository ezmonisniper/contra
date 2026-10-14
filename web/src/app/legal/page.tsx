import type { Metadata } from "next";
import ui from "@/components/ui.module.css";
import styles from "../prose.module.css";

export const metadata: Metadata = { title: "Terms & risks" };

/*
 * DRAFT. This page is a plain-language starting point, not legal advice.
 * Have a lawyer review it, and fill in the bracketed items, before launch.
 */
export default function Legal() {
  return (
    <article className={`${ui.container} ${styles.prose}`}>
      <p className={ui.eyebrow}>Terms &amp; risks · draft</p>
      <h1 className={ui.title}>The short version</h1>
      <ul>
        <li>Contra is information and software. It is not a broker, an exchange, or financial advice.</li>
        <li>You can lose the full amount of every fade. Past results don&apos;t predict future ones.</li>
        <li>Contra never holds your funds or keys. You sign every transaction in your own wallet.</li>
        <li>
          Trades are executed by third parties (Jupiter, and the Polymarket or Kalshi markets behind it). Their rules
          and eligibility requirements apply, including where you live.
        </li>
      </ul>

      <h2 className={ui.heading}>Eligibility</h2>
      <p>
        Prediction markets are restricted or prohibited in some places. It is your responsibility to make sure you may
        use them where you are. If a market provider refuses your order, Contra cannot override it, and must not be
        used to get around such restrictions.
      </p>

      <h2 className={ui.heading}>What the Fade List is</h2>
      <p>
        The Fade List is a statistical summary of public blockchain activity. A wallet&apos;s place on it describes
        its past results compared with market odds. It says nothing about any person, and Contra does not identify,
        and asks no one to identify, who controls a wallet.
      </p>

      <h2 id="removal" className={ui.heading}>Removal requests</h2>
      <p>
        If you control a listed wallet and want it removed, email [contact email] from an address we can reply to and
        sign a short message with that wallet to prove control. We remove verified wallets from public pages at the next
        update.
      </p>

      <h2 className={ui.heading}>No warranty</h2>
      <p>
        Contra is provided as is. Data can be delayed, incomplete or wrong. Prices shown can change before an order
        fills. To the extent the law allows, Contra is not liable for trading losses.
      </p>

      <p className={ui.caption}>Last updated [date]. Operated by [legal entity name], [jurisdiction].</p>
    </article>
  );
}
