"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useState } from "react";
import { api, errorMessage } from "@/lib/client-api";
import { cents, usd } from "@/lib/format";
import { bytesToB64, decodeTx } from "@/lib/tx";
import ui from "../ui.module.css";

type Position = {
  pubkey: string;
  marketId: string;
  isYes: boolean;
  contracts: number | null;
  avgPrice: number | null;
  costUsd: number | null;
  valueUsd: number | null;
  pnlUsd: number | null;
  claimable: boolean;
  claimed: boolean;
};

export function PositionsView() {
  const { publicKey, signTransaction, connected } = useWallet();
  const [loaded, setLoaded] = useState<{ owner: string; positions: Position[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const owner = publicKey?.toBase58();
  // Only show positions fetched for the wallet that is connected right now.
  const positions = loaded && loaded.owner === owner ? loaded.positions : null;

  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (!owner) return;
    let live = true;
    api<{ positions: Position[] }>(`/api/positions?owner=${owner}`)
      .then((r) => {
        if (!live) return;
        setLoaded({ owner, positions: r.positions });
        setError(null);
      })
      .catch((err: unknown) => {
        if (live) setError(errorMessage(err));
      });
    return () => {
      live = false;
    };
  }, [owner, version]);

  const claim = async (p: Position) => {
    if (!publicKey || !signTransaction) return;
    setBusy(p.pubkey);
    setNotice(null);
    setError(null);
    try {
      const { transaction } = await api<{ transaction: string }>(`/api/positions/${p.pubkey}/claim`, {
        method: "POST",
        body: { ownerPubkey: publicKey.toBase58() },
      });
      const tx = decodeTx(transaction);
      if (!tx.message.staticAccountKeys[0]?.equals(publicKey) || tx.message.header.numRequiredSignatures !== 1) {
        throw new Error("Unexpected transaction. Not signing it.");
      }
      const signed = await signTransaction(tx);
      await api<{ signature: string }>("/api/transactions", {
        method: "POST",
        body: { transaction: bytesToB64(signed.serialize()) },
      });
      setNotice("Claim sent. Your USDC will arrive in a few seconds.");
      setTimeout(refresh, 4000);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  if (!connected || !owner) {
    return <p className={ui.muted}>Connect your wallet (top right) to see your fades.</p>;
  }

  return (
    <div className={ui.stack}>
      {error && (
        <p role="alert" className={ui.loss}>
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      {positions === null && !error && <p className={ui.muted}>Loading your positions…</p>}
      {positions?.length === 0 && <p className={ui.muted}>No positions yet. Fade a bet from the Fade List.</p>}
      {positions && positions.length > 0 && (
        <div className={ui.tableWrap}>
          <table className={ui.table}>
            <caption>Your positions</caption>
            <thead>
              <tr>
                <th scope="col">Market</th>
                <th scope="col">Side</th>
                <th scope="col" className={ui.right}>
                  Contracts
                </th>
                <th scope="col" className={ui.right}>
                  Avg price
                </th>
                <th scope="col" className={ui.right}>
                  P&amp;L
                </th>
                <th scope="col" className={ui.right}>
                  <span className="visually-hidden">Action</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.pubkey}>
                  <td className={ui.mono}>{p.marketId}</td>
                  <td>{p.isYes ? "YES" : "NO"}</td>
                  <td className={`${ui.right} ${ui.mono}`}>{p.contracts ?? "–"}</td>
                  <td className={`${ui.right} ${ui.mono}`}>{p.avgPrice != null ? cents(p.avgPrice) : "–"}</td>
                  <td className={`${ui.right} ${ui.figure} ${p.pnlUsd == null ? "" : p.pnlUsd >= 0 ? ui.gain : ui.loss}`}>
                    {p.pnlUsd != null ? usd(p.pnlUsd, { signed: true }) : "–"}
                  </td>
                  <td className={ui.right}>
                    {p.claimable && !p.claimed ? (
                      <button type="button" className={ui.primary} disabled={busy !== null} onClick={() => void claim(p)}>
                        {busy === p.pubkey ? "Claiming…" : "Claim"}
                      </button>
                    ) : p.claimed ? (
                      <span className={ui.caption}>Claimed</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
