#!/usr/bin/env python3
"""
Generate fake prediction-market data with a KNOWN answer, to prove backtest.py
finds real edges and doesn't invent fake ones.

Scenarios:
  null       Prices are fair; every wallet trades at random. Fading anyone should
             lose about the trading costs. Any "edge" found here would be a bug.
  longshot   Prices overrate long shots, and "dumb" wallets love long shots.
             Fading them should profit, but only as much as buying favorites
             blindly would (edge from following them ~0).
  antiskill  Prices are fair, but "dumb" wallets genuinely pick losers.
             Fading them should profit AND beat the same-price control.
"""
import argparse
import os

import numpy as np
import pandas as pd

DAY = 86400


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("scenario", choices=["null", "longshot", "antiskill"])
    ap.add_argument("--out", default=None)
    ap.add_argument("--markets", type=int, default=3000)
    ap.add_argument("--wallets", type=int, default=3000)
    ap.add_argument("--trades", type=int, default=200000)
    ap.add_argument("--seed", type=int, default=1)
    ap.add_argument("--bias", type=float, default=0.75, help="longshot only: <1 overprices long shots")
    a = ap.parse_args()
    out = a.out or f"sim_{a.scenario}"
    os.makedirs(out, exist_ok=True)
    rng = np.random.default_rng(a.seed)

    # markets
    start = rng.uniform(0, 330 * DAY, a.markets).astype(int)
    dur = rng.uniform(3 * DAY, 40 * DAY, a.markets).astype(int)
    q = rng.uniform(0.03, 0.97, a.markets)            # true probability outcome 0 ("Yes") wins
    winner = np.where(rng.random(a.markets) < q, 0, 1)
    logit = np.log(q / (1 - q))
    if a.scenario == "longshot":
        price0 = 1 / (1 + np.exp(-a.bias * logit))     # squashed toward 50c: long shots overpriced
    else:
        price0 = q                                   # fair prices
    ids = np.array([f"m{i:05d}" for i in range(a.markets)])
    pd.DataFrame({"market_id": ids, "question": [f"Sim market {i}" for i in range(a.markets)],
                  "slug": ids, "resolve_ts": start + dur, "winner_index": winner,
                  "volume": 0}).to_csv(os.path.join(out, "markets.csv"), index=False)

    # wallets: activity is heavy-tailed; 5% are "dumb" except in the null world
    wid = np.array([f"0x{i:040x}" for i in range(a.wallets)])
    wtype = np.where(rng.random(a.wallets) < (0.0 if a.scenario == "null" else 0.05), "dumb", "noise")
    activity = rng.pareto(1.3, a.wallets) + 1
    activity /= activity.sum()
    pd.DataFrame({"wallet": wid, "type": wtype}).to_csv(os.path.join(out, "truth.csv"), index=False)

    # trades
    n = a.trades
    mk = rng.integers(0, a.markets, n)
    wk = rng.choice(a.wallets, size=n, p=activity)
    ts = start[mk] + (rng.random(n) * dur[mk]).astype(int)
    p0 = np.clip(price0[mk] + rng.normal(0, 0.005, n), 0.01, 0.99)
    side_out = rng.integers(0, 2, n)                  # noise traders: random outcome
    dumb = wtype[wk] == "dumb"
    if a.scenario == "longshot":
        longshot = np.where(p0 < 0.5, 0, 1)
        pick_ls = rng.random(n) < 0.85
        side_out = np.where(dumb & pick_ls, longshot, side_out)
    elif a.scenario == "antiskill":
        loser = 1 - winner[mk]
        pick_l = rng.random(n) < 0.30
        side_out = np.where(dumb & pick_l, loser, side_out)
    price = np.where(side_out == 0, p0, 1 - p0)
    is_buy = rng.random(n) < 0.8
    size = np.round(np.exp(rng.normal(3.5, 1.0, n)) / price, 2)
    pd.DataFrame({"market_id": ids[mk], "wallet": wid[wk], "ts": ts,
                  "side": np.where(is_buy, "BUY", "SELL"), "outcome_index": side_out,
                  "price": np.round(price, 4), "size": size,
                  "tx": [f"tx{i}" for i in range(n)]}).sort_values("ts").to_csv(
        os.path.join(out, "trades.csv"), index=False)
    print(f"wrote {out}/ ({a.scenario}): {a.markets} markets, {n} trades, "
          f"{(wtype == 'dumb').sum()} dumb wallets")


if __name__ == "__main__":
    main()
