import Link from "next/link";
import { ConnectButton } from "./wallet/ConnectButton";
import styles from "./SiteHeader.module.css";
import ui from "./ui.module.css";

export function SiteHeader() {
  return (
    <header className={styles.header}>
      <div className={`${ui.container} ${styles.inner}`}>
        <Link href="/" className={styles.logo} aria-label="Contra home">
          {/* eslint-disable-next-line @next/next/no-img-element -- static SVG logo, no optimization needed */}
          <img src="/brand/contra-lockup.svg" alt="Contra" width={150} height={28} />
        </Link>
        <nav aria-label="Main" className={styles.nav}>
          <Link href="/">Fade List</Link>
          <Link href="/how-it-works">How it works</Link>
          <Link href="/positions">My fades</Link>
        </nav>
        <ConnectButton />
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`${ui.container} ${styles.footerInner}`}>
        <span>Not financial advice. Past results don&apos;t predict future ones.</span>
        <span className={styles.footerLinks}>
          <Link href="/legal">Terms &amp; risks</Link>
          <span>© Contra</span>
        </span>
      </div>
    </footer>
  );
}
