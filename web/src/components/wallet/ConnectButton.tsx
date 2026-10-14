"use client";

import { WalletReadyState, type WalletName } from "@solana/wallet-adapter-base";
import { useWallet } from "@solana/wallet-adapter-react";
import { useEffect, useId, useRef, useState } from "react";
import { shortAddress } from "@/lib/format";
import ui from "../ui.module.css";
import styles from "./ConnectButton.module.css";

export function ConnectButton() {
  const { wallets, select, disconnect, connected, connecting, publicKey } = useWallet();
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapRef = useRef<HTMLDivElement>(null);

  const installed = wallets.filter(
    (w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable,
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  // Selecting a wallet is enough: the provider (autoConnect) asks it to connect.
  const choose = (name: WalletName) => {
    setOpen(false);
    select(name);
  };

  if (connected && publicKey) {
    const addr = publicKey.toBase58();
    return (
      <div className={styles.wrap} ref={wrapRef}>
        <button
          type="button"
          className={ui.secondary}
          aria-expanded={open}
          aria-controls={menuId}
          onClick={() => setOpen((o) => !o)}
        >
          <span className={styles.address}>{shortAddress(addr)}</span>
        </button>
        {open && (
          <div className={styles.menu} id={menuId}>
            <a className={styles.item} href="/positions">
              My fades
            </a>
            <button
              type="button"
              className={styles.item}
              onClick={() => {
                setOpen(false);
                void disconnect();
              }}
            >
              Disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={ui.primary}
        aria-expanded={open}
        aria-controls={menuId}
        disabled={connecting}
        onClick={() => setOpen((o) => !o)}
      >
        {connecting ? "Connecting…" : "Connect wallet"}
      </button>
      {open && (
        <div className={styles.menu} id={menuId}>
          {installed.length > 0 ? (
            installed.map((w) => (
              <button key={w.adapter.name} type="button" className={styles.item} onClick={() => choose(w.adapter.name)}>
                {/* eslint-disable-next-line @next/next/no-img-element -- wallet-provided data: icon */}
                <img src={w.adapter.icon} alt="" />
                {w.adapter.name}
              </button>
            ))
          ) : (
            <p className={styles.note}>
              No Solana wallet found in this browser. Install{" "}
              <a href="https://phantom.com" rel="noopener noreferrer" target="_blank">
                Phantom
              </a>{" "}
              or{" "}
              <a href="https://solflare.com" rel="noopener noreferrer" target="_blank">
                Solflare
              </a>
              , then reload.
            </p>
          )}
          <p className={styles.note}>Contra only asks your wallet to sign. It never sees your keys.</p>
        </div>
      )}
    </div>
  );
}
