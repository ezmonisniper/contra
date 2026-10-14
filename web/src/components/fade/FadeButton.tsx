"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { api, errorMessage, sleep } from "@/lib/client-api";
import { fadeAllowed, type FadePolicy, type OpenBet } from "@/lib/fade-list";
import { cents, usd } from "@/lib/format";
import { bytesToB64, decodeTx } from "@/lib/tx";
import ui from "../ui.module.css";
import styles from "./FadeButton.module.css";

type Market = { marketId: string; title: string; status: string; buyYes: number | null; buyNo: number | null };
type CreatedOrder = { orderPubkey: string; transaction: string; contracts: number | null; feeUsd: number | null };

type Step =
  | { k: "loading" }
  | { k: "ready"; market: Market; price: number }
  | { k: "blocked"; message: string }
  | { k: "working"; label: string }
  | { k: "done"; signature: string; filled: boolean }
  | { k: "error"; message: string; market?: Market; price?: number };

const PRESETS = [5, 10, 25];

export function FadeButton({ bet, policy, sample }: { bet: OpenBet; policy: FadePolicy; sample: boolean }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [step, setStep] = useState<Step>({ k: "loading" });
  const [amount, setAmount] = useState("10");
  const [ack, setAck] = useState(false);

  // Polymarket's first outcome is the YES token. Fading buys the other one.
  const buyYes = bet.outcomeIndex === 1;

  const load = useCallback(async () => {
    setStep({ k: "loading" });
    try {
      const { market } = await api<{ market: Market }>(`/api/markets/resolve?q=${encodeURIComponent(bet.question)}`);
      const price = buyYes ? market.buyYes : market.buyNo;
      if (price == null) return setStep({ k: "blocked", message: "No live price for this side right now." });
      if (!fadeAllowed(price, policy)) {
        return setStep({
          k: "blocked",
          message:
            `Fading here means buying ${bet.otherOutcome} at ${cents(price)}. ` +
            `Contra only fades between ${cents(policy.minFadePrice)} and ${cents(policy.maxFadePrice)}: ` +
            `our backtest found that buying long shots loses money even against bad traders.`,
        });
      }
      setStep({ k: "ready", market, price });
    } catch (err) {
      setStep({ k: "blocked", message: errorMessage(err) });
    }
  }, [bet.question, bet.otherOutcome, buyYes, policy]);

  const openDialog = () => {
    setAck(false);
    dialogRef.current?.showModal();
    void load();
  };

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onClose = () => setStep({ k: "loading" });
    d.addEventListener("close", onClose);
    return () => d.removeEventListener("close", onClose);
  }, []);

  const amountNum = Number(amount);
  const amountValid = Number.isFinite(amountNum) && amountNum >= 1 && Math.round(amountNum * 100) === amountNum * 100;

  const confirm = async (market: Market, price: number) => {
    if (!publicKey || !signTransaction) return;
    try {
      setStep({ k: "working", label: "Preparing your order…" });
      const { order } = await api<{ order: CreatedOrder }>("/api/orders", {
        method: "POST",
        body: { ownerPubkey: publicKey.toBase58(), marketId: market.marketId, isYes: buyYes, amountUsd: amountNum },
      });

      // Check again in the browser: never sign something that isn't yours alone to sign.
      const tx = decodeTx(order.transaction);
      if (!tx.message.staticAccountKeys[0]?.equals(publicKey) || tx.message.header.numRequiredSignatures !== 1) {
        throw new Error("Unexpected transaction. Not signing it.");
      }

      setStep({ k: "working", label: "Approve the fade in your wallet…" });
      const signed = await signTransaction(tx);

      setStep({ k: "working", label: "Sending…" });
      const { signature } = await api<{ signature: string }>("/api/transactions", {
        method: "POST",
        body: { transaction: bytesToB64(signed.serialize()) },
      });

      setStep({ k: "working", label: "Waiting for the order to fill…" });
      let filled = false;
      for (let i = 0; i < 30; i++) {
        await sleep(2000);
        const { status } = await api<{ status: string }>(`/api/orders/${order.orderPubkey}`).catch(() => ({
          status: "pending",
        }));
        if (status === "filled") {
          filled = true;
          break;
        }
        if (status === "failed") throw new Error("The order didn't fill. Your USDC stays in your wallet.");
      }
      setStep({ k: "done", signature, filled });
    } catch (err) {
      const message = err instanceof Error && !("error" in err) && /Unexpected|didn't fill/.test(err.message)
        ? err.message
        : errorMessage(err);
      setStep({ k: "error", message, market, price });
    }
  };

  if (sample) {
    return (
      <button type="button" className={ui.secondary} disabled title="Fades are disabled on sample data">
        Fade · {bet.otherOutcome}
      </button>
    );
  }

  const contracts = step.k === "ready" && amountValid ? Math.floor(amountNum / step.price) : 0;

  return (
    <>
      <button type="button" className={ui.secondary} onClick={openDialog}>
        Fade · {bet.otherOutcome}
      </button>
      <dialog ref={dialogRef} className={styles.dialog} aria-labelledby={titleId}>
        <div className={styles.body}>
          <h2 id={titleId} className={ui.heading}>
            Fade this bet
          </h2>
          <p className={ui.muted}>{bet.question}</p>

          <div className={styles.sides}>
            <div className={styles.side}>
              <span className={styles.sideLabel}>Their side</span>
              <span className={styles.sideValue}>
                {bet.outcome} <span className={ui.figure}>at {cents(bet.price)}</span>
              </span>
            </div>
            <div className={styles.yours}>
              <span className={styles.sideLabel}>Your side</span>
              <span className={styles.sideValue}>
                {bet.otherOutcome}{" "}
                {step.k === "ready" && <span className={ui.figure}>at {cents(step.price)}</span>}
              </span>
            </div>
          </div>

          {step.k === "loading" && <p className={styles.status}>Finding this market on Solana…</p>}
          {step.k === "blocked" && <p className={styles.status}>{step.message}</p>}

          {step.k === "ready" && (
            <>
              <label className={ui.field}>
                Amount (USDC)
                <input
                  className={ui.input}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 8))}
                  aria-invalid={!amountValid}
                />
              </label>
              <div className={styles.presets}>
                {PRESETS.map((p) => (
                  <button key={p} type="button" className={ui.ghost} onClick={() => setAmount(String(p))}>
                    {usd(p)}
                  </button>
                ))}
              </div>
              <div className={styles.summary}>
                <div className={styles.row}>
                  <span className={ui.muted}>Contracts</span>
                  <span className={ui.figure}>≈ {contracts}</span>
                </div>
                <div className={styles.row}>
                  <span className={ui.muted}>Pays if {bet.otherOutcome}</span>
                  <span className={`${ui.figure} ${ui.gain}`}>{usd(contracts)}</span>
                </div>
                <div className={styles.row}>
                  <span className={ui.muted}>If {bet.outcome}</span>
                  <span className={`${ui.figure} ${ui.loss}`}>{usd(-amountNum || 0, { signed: true })}</span>
                </div>
                <p className={ui.caption}>Price can move before your order fills. Fees are shown in your wallet.</p>
              </div>
              <label className={styles.check}>
                <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />
                <span>I understand I can lose the full amount, and this is not financial advice.</span>
              </label>
            </>
          )}

          {step.k === "working" && (
            <p className={styles.status} role="status">
              {step.label}
            </p>
          )}
          {step.k === "error" && (
            <p className={styles.error} role="alert">
              {step.message}
            </p>
          )}
          {step.k === "done" && (
            <p className={styles.status} role="status">
              {step.filled ? "Done. You've faded this bet." : "Sent. The order is still filling: check My fades in a minute."}{" "}
              <a href={`https://solscan.io/tx/${step.signature}`} target="_blank" rel="noopener noreferrer">
                View transaction
              </a>
            </p>
          )}

          <div className={styles.actions}>
            <button type="button" className={ui.ghost} onClick={() => dialogRef.current?.close()}>
              {step.k === "done" ? "Close" : "Cancel"}
            </button>
            {step.k === "ready" &&
              (connected ? (
                <button
                  type="button"
                  className={ui.primary}
                  disabled={!amountValid || !ack || contracts < 1}
                  onClick={() => void confirm(step.market, step.price)}
                >
                  Confirm in wallet
                </button>
              ) : (
                <span className={ui.caption}>Connect a wallet (top right) to fade.</span>
              ))}
            {step.k === "error" && step.market && step.price != null && (
              <button type="button" className={ui.secondary} onClick={() => setStep({ k: "ready", market: step.market!, price: step.price! })}>
                Try again
              </button>
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}
