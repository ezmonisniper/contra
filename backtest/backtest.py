#!/usr/bin/env python3
"""
Fade-the-worst backtest.

Question: if you had bet AGAINST the wallets with the worst prediction-market
track records, every time they bought, would you have made money after costs?
And is any profit more than the well-known favorite-longshot bias (i.e. could
you get the same result by just buying favorites without following anyone)?

No lookahead: a wallet is judged only on markets that had already RESOLVED
before the moment it is faded. Rankings are recomputed every --rescore-days.

    python3 backtest.py --data data
    python3 backtest.py --data data --rank-by shame   # rank by "confidently wrong"

Outputs (in --out, default results/):
    report.txt         human-readable summary
    results.json       all numbers
    fades.csv          every simulated fade bet
    wall_of_shame.csv  the current most-confidently-wrong wallets
"""
import argparse
import json
import os

import numpy as np
import pandas as pd

DAY = 86400


# ---------------------------------------------------------------- loading
def load(data_dir):
    m = pd.read_csv(os.path.join(data_dir, "markets.csv"), dtype={"market_id": str}, encoding="utf-8")
    t = pd.read_csv(os.path.join(data_dir, "trades.csv"), dtype={"market_id": str, "wallet": str, "tx": str}, encoding="utf-8")
    t = t.drop_duplicates()
    t = t[(t.price > 0) & (t.price < 1) & (t["size"] > 0)]
    t = t.merge(m[["market_id", "resolve_ts", "winner_index", "question"]], on="market_id", how="inner")
    t = t[t.ts < t.resolve_ts]  # ignore post-resolution clean-up trades
    t["won"] = (t.outcome_index == t.winner_index).astype(np.int8)
    t["side"] = t.side.str.upper()
    return m, t.sort_values("ts", kind="mergesort").reset_index(drop=True)


# ---------------------------------------------------------------- scoring
def wallet_stats(buys, a):
    """Per-wallet track record on resolved buys (held-to-resolution accounting)."""
    b = buys.assign(stake=buys.price * buys["size"],
                    pnl=buys["size"] * (buys.won - buys.price))
    g = b.groupby("wallet", sort=False)
    s = pd.DataFrame({"bets": g.size(), "markets": g.market_id.nunique(),
                      "staked": g.stake.sum(), "pnl": g.pnl.sum()})
    s["roi"] = s.pnl / s.staked
    # shrunk ROI: a wallet needs real volume before it can look extreme
    s["edge_score"] = s.pnl / (s.staked + a.k_usd)

    c = b[b.price >= a.conf]
    c = c.assign(lost=1 - c.won, exp_lost=1 - c.price, lost_usd=c.stake * (1 - c.won))
    gc = c.groupby("wallet", sort=False)
    cs = pd.DataFrame({"conf_bets": gc.size(), "conf_losses": gc.lost.sum(),
                       "exp_conf_losses": gc.exp_lost.sum(), "conf_lost_usd": gc.lost_usd.sum()})
    s = s.join(cs, how="left").fillna({"conf_bets": 0, "conf_losses": 0,
                                       "exp_conf_losses": 0, "conf_lost_usd": 0})
    # "confidently wrong": lost more high-confidence bets than the odds implied (shrunk)
    s["shame_score"] = (s.conf_losses - s.exp_conf_losses) / (s.conf_bets + a.k_conf)

    # z-score: how many standard deviations better/worse than the odds the wallet's
    # picks did. One pick per market (first buy), so repeat buys don't inflate it.
    f = b.drop_duplicates(["wallet", "market_id"], keep="first")
    f = f.assign(err=f.won - f.price, var=f.price * (1 - f.price))
    gz = f.groupby("wallet", sort=False)
    s["z_score"] = gz.err.sum() / np.sqrt(gz["var"].sum())
    s["eligible"] = (s.bets >= a.min_bets) & (s.markets >= a.min_markets)
    return s


def select(stats, a, rng):
    e = stats[stats.eligible]
    if a.rank_by == "shame":
        worst = e[e.shame_score >= a.min_bad].sort_values("shame_score", ascending=False)
        best = e[e.shame_score <= -a.min_bad].sort_values("shame_score")
    elif a.rank_by == "edge":
        worst = e[e.edge_score <= -a.min_bad].sort_values("edge_score")
        best = e[e.edge_score >= a.min_bad].sort_values("edge_score", ascending=False)
    else:
        worst = e[e.z_score <= -a.min_bad].sort_values("z_score")
        best = e[e.z_score >= a.min_bad].sort_values("z_score", ascending=False)
    worst = list(worst.index[: a.top_k])
    best = list(best.index[: a.top_k])
    n = len(worst)
    randoms = [list(rng.choice(e.index.values, size=min(n, len(e)), replace=False)) if n and len(e) else []
               for _ in range(a.random_reps)]
    return worst, best, randoms


# ---------------------------------------------------------------- execution
def fill(opps, trades, a):
    """Price we would actually pay for the opposite outcome, after a reaction delay."""
    o = opps.copy()
    o["fade_outcome"] = 1 - o.outcome_index
    o["t_exec"] = o.ts + a.delay
    book = trades[["market_id", "ts", "outcome_index", "price"]].copy()
    book["p0"] = np.where(book.outcome_index == 0, book.price, 1 - book.price)
    book = book.rename(columns={"ts": "t_exec"})[["market_id", "t_exec", "p0"]].sort_values("t_exec")
    o = pd.merge_asof(o.sort_values("t_exec"), book, on="t_exec", by="market_id",
                      direction="forward", tolerance=a.max_wait)
    immediate = 1 - o.price  # complement of the price the faded wallet paid
    later = np.where(o.fade_outcome == 0, o.p0, 1 - o.p0)
    o["raw_q"] = np.where(o.p0.notna(), later, immediate)
    o["used_next_trade"] = o.p0.notna()
    o = o[(o.raw_q >= a.min_price) & (o.raw_q <= a.max_price)]
    o["q"] = np.minimum(o.raw_q + a.half_spread + a.fee, 0.995)
    o["fade_won"] = (o.winner_index == o.fade_outcome).astype(int)
    o["stake"] = a.stake
    o["pnl"] = a.stake / o.q * o.fade_won - a.stake
    return o.drop(columns=["p0"])


def run_strategy(sel_by_cp, opps, trades, a):
    rows = [(i, w) for i, ws in enumerate(sel_by_cp) for w in ws]
    if not rows:
        return opps.iloc[0:0].assign(q=[], pnl=[], stake=[], fade_won=[], raw_q=[])
    sel = pd.DataFrame(rows, columns=["cp", "wallet"])
    hit = opps.merge(sel, on=["cp", "wallet"], how="inner")
    if hit.empty:
        return hit.assign(q=[], pnl=[], stake=[], fade_won=[], raw_q=[])
    return fill(hit, trades, a)


# ---------------------------------------------------------------- statistics
def summarize(f, calib, rng, reps=2000):
    if len(f) == 0:
        return {"fades": 0}
    f = f.assign(bin=np.clip((f.raw_q * 20).astype(int), 0, 19))
    f = f.merge(calib, on="bin", how="left")
    f["exp_win"] = f.exp_win.fillna(f.raw_q)
    f["ctrl_pnl"] = f.stake / f.q * f.exp_win - f.stake  # same prices, average wallet's luck
    per_m = f.groupby("market_id").agg(pnl=("pnl", "sum"), stake=("stake", "sum"),
                                       ctrl=("ctrl_pnl", "sum"))
    P, S, C = per_m.pnl.values, per_m.stake.values, per_m.ctrl.values
    idx = rng.integers(0, len(per_m), size=(reps, len(per_m)))
    roi_bs = P[idx].sum(1) / S[idx].sum(1)
    exc_bs = (P[idx].sum(1) - C[idx].sum(1)) / S[idx].sum(1)
    roi = P.sum() / S.sum()
    ctrl = C.sum() / S.sum()
    return {
        "fades": int(len(f)), "markets": int(len(per_m)), "wallets": int(f.wallet.nunique()),
        "staked": float(S.sum()), "pnl": float(P.sum()),
        "roi": float(roi), "roi_ci95": [float(np.percentile(roi_bs, 2.5)), float(np.percentile(roi_bs, 97.5))],
        "win_rate": float(f.fade_won.mean()), "avg_price_paid": float(f.q.mean()),
        "control_roi_same_prices": float(ctrl),
        "excess_roi_vs_control": float(roi - ctrl),
        "excess_ci95": [float(np.percentile(exc_bs, 2.5)), float(np.percentile(exc_bs, 97.5))],
        "share_filled_from_next_trade": float(f.used_next_trade.mean()) if "used_next_trade" in f else None,
    }


def by_bucket(f):
    if len(f) == 0:
        return []
    edges = [0, 0.2, 0.4, 0.6, 0.8, 1.0]
    lab = ["<20c", "20-40c", "40-60c", "60-80c", ">80c"]
    g = f.assign(bucket=pd.cut(f.q, edges, labels=lab)).groupby("bucket", observed=True)
    out = g.agg(fades=("pnl", "size"), pnl=("pnl", "sum"), stake=("stake", "sum"), win=("fade_won", "mean"))
    out["roi"] = out.pnl / out.stake
    return [{"bucket": str(k), "fades": int(r.fades), "roi": round(float(r.roi), 4),
             "win_rate": round(float(r.win), 4)} for k, r in out.iterrows()]


# ---------------------------------------------------------------- main
def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data")
    ap.add_argument("--out", default="results")
    ap.add_argument("--rank-by", choices=["z", "edge", "shame"], default="z",
                    help="z = picks most consistently worse than the odds (default); "
                         "edge = worst dollar ROI; shame = most high-confidence bets lost vs the odds")
    ap.add_argument("--warmup-days", type=float, default=90, help="history before the first fade")
    ap.add_argument("--rescore-days", type=float, default=7)
    ap.add_argument("--min-bets", type=int, default=20)
    ap.add_argument("--min-markets", type=int, default=10)
    ap.add_argument("--k-usd", type=float, default=1000, help="shrinkage for ROI score")
    ap.add_argument("--k-conf", type=float, default=10, help="shrinkage for shame score")
    ap.add_argument("--conf", type=float, default=0.70, help="price that counts as 'confident'")
    ap.add_argument("--min-bad", type=float, default=None,
                    help="score a wallet needs to be flagged (default: 2.0 for z, 0.05 otherwise)")
    ap.add_argument("--top-k", type=int, default=100, help="wallets flagged per checkpoint")
    ap.add_argument("--stake", type=float, default=10, help="USDC per fade")
    ap.add_argument("--delay", type=int, default=5, help="seconds between their trade and ours")
    ap.add_argument("--max-wait", type=int, default=3600, help="seconds to look for a next trade to price our fill")
    ap.add_argument("--half-spread", type=float, default=0.01, help="cost per share, in dollars")
    ap.add_argument("--fee", type=float, default=0.0, help="extra cost per share, in dollars")
    ap.add_argument("--min-price", type=float, default=0.03)
    ap.add_argument("--max-price", type=float, default=0.97)
    ap.add_argument("--random-reps", type=int, default=20)
    ap.add_argument("--seed", type=int, default=7)
    ap.add_argument("--truth", help="(simulation only) CSV of wallet,type to check who got flagged")
    a = ap.parse_args()
    if a.min_bad is None:
        a.min_bad = 2.0 if a.rank_by == "z" else 0.05
    rng = np.random.default_rng(a.seed)
    os.makedirs(a.out, exist_ok=True)

    markets, trades = load(a.data)
    buys = trades[trades.side == "BUY"]
    t0 = int(trades.ts.min() + a.warmup_days * DAY)
    cps = np.arange(t0, trades.ts.max() + 1, int(a.rescore_days * DAY))
    if len(cps) == 0:
        raise SystemExit("Not enough history: lower --warmup-days or download more days.")

    sel_worst, sel_best, sel_rand = [], [], [[] for _ in range(a.random_reps)]
    for c in cps:
        hist = buys[buys.resolve_ts < c]
        if hist.empty:
            sel_worst.append([]); sel_best.append([])
            for r in sel_rand: r.append([])
            continue
        w, b, rs = select(wallet_stats(hist, a), a, rng)
        sel_worst.append(w); sel_best.append(b)
        for r, x in zip(sel_rand, rs or [[]] * a.random_reps):
            r.append(x)

    # fade opportunities: a wallet's FIRST buy in each market during the test window
    test = buys[buys.ts >= cps[0]]
    opps = test.drop_duplicates(["wallet", "market_id"], keep="first").copy()
    opps["cp"] = np.searchsorted(cps, opps.ts.values, side="right") - 1

    # market-wide calibration in the test window: how often does a contract bought at price p win?
    calib = (test.assign(bin=np.clip((test.price * 20).astype(int), 0, 19))
             .groupby("bin").won.mean().rename("exp_win").reset_index())

    worst = run_strategy(sel_worst, opps, trades, a)
    best = run_strategy(sel_best, opps, trades, a)
    rand = [summarize(run_strategy(s, opps, trades, a), calib, rng, reps=300) for s in sel_rand]
    rand_rois = [r["roi"] for r in rand if r.get("fades")]

    res = {
        "settings": vars(a),
        "data": {"markets": int(markets.shape[0]), "trades": int(len(trades)),
                 "wallets": int(trades.wallet.nunique()),
                 "test_window_days": round((trades.ts.max() - cps[0]) / DAY, 1),
                 "avg_flagged_per_checkpoint": round(float(np.mean([len(x) for x in sel_worst])), 1)},
        "fade_worst": summarize(worst, calib, rng),
        "fade_worst_by_price": by_bucket(worst),
        "fade_best_sanity_check": summarize(best, calib, rng),
        "fade_random_wallets": {"reps": len(rand_rois),
                                "mean_roi": float(np.mean(rand_rois)) if rand_rois else None,
                                "range_5_95": [float(np.percentile(rand_rois, 5)), float(np.percentile(rand_rois, 95))]
                                if rand_rois else None},
    }

    if a.truth:
        truth = pd.read_csv(a.truth, dtype={"wallet": str}).set_index("wallet").type
        flagged = pd.Series([w for ws in sel_worst for w in ws])
        res["truth_flagged_types"] = flagged.map(truth).value_counts(normalize=True).round(3).to_dict()
        res["truth_population_types"] = truth.value_counts(normalize=True).round(3).to_dict()

    # Wall of Shame: everyone judged on everything that has resolved
    final = wallet_stats(buys, a)
    final = final[final.eligible & (final.conf_bets >= 5)].sort_values("shame_score", ascending=False).head(100)
    lost = buys[(buys.price >= a.conf) & (buys.won == 0)].assign(stake=lambda d: d.price * d["size"])
    worst_l = lost.sort_values("stake").drop_duplicates("wallet", keep="last").set_index("wallet")
    wall = final.join(worst_l[["question", "price", "stake"]].rename(
        columns={"question": "worst_confident_loss", "price": "loss_price", "stake": "loss_usd"}), how="left")
    wall.index.name = "wallet"
    cols = ["bets", "markets", "staked", "pnl", "roi", "conf_bets", "conf_losses", "exp_conf_losses",
            "shame_score", "z_score", "worst_confident_loss", "loss_price", "loss_usd"]
    wall[cols].round(4).to_csv(os.path.join(a.out, "wall_of_shame.csv"))
    worst.to_csv(os.path.join(a.out, "fades.csv"), index=False)
    with open(os.path.join(a.out, "results.json"), "w", encoding="utf-8") as f:
        json.dump(res, f, indent=2, default=str)

    report = render(res)
    with open(os.path.join(a.out, "report.txt"), "w", encoding="utf-8") as f:
        f.write(report)
    print(report)


def pct(x):
    return "n/a" if x is None else f"{x * 100:+.1f}%"


def render(r):
    fw, fb, fr = r["fade_worst"], r["fade_best_sanity_check"], r["fade_random_wallets"]
    L = [f"Data: {r['data']['markets']} markets, {r['data']['trades']} trades, {r['data']['wallets']} wallets; "
         f"test window {r['data']['test_window_days']} days, ~{r['data']['avg_flagged_per_checkpoint']} wallets flagged per week",
         ""]
    if not fw.get("fades"):
        L.append("No fades were triggered. Loosen --min-bets / --min-bad or download more data.")
        return "\n".join(L) + "\n"
    L += [f"FADE THE WORST: {fw['fades']} bets across {fw['markets']} markets, {fw['wallets']} wallets faded",
          f"  ROI after costs: {pct(fw['roi'])}  (95% CI {pct(fw['roi_ci95'][0])} to {pct(fw['roi_ci95'][1])})",
          f"  win rate {fw['win_rate']:.1%}, avg price paid {fw['avg_price_paid']:.2f}",
          f"  same prices, average luck (control): {pct(fw['control_roi_same_prices'])}",
          f"  EDGE FROM FOLLOWING THESE WALLETS: {pct(fw['excess_roi_vs_control'])} "
          f"(95% CI {pct(fw['excess_ci95'][0])} to {pct(fw['excess_ci95'][1])})", ""]
    L.append("  by price paid: " + ", ".join(f"{b['bucket']} {pct(b['roi'])} (n={b['fades']})"
                                            for b in r["fade_worst_by_price"]))
    L += ["", f"Fade random wallets (baseline): mean ROI {pct(fr['mean_roi'])}, "
              f"5-95% range {pct(fr['range_5_95'][0]) if fr['range_5_95'] else 'n/a'} to "
              f"{pct(fr['range_5_95'][1]) if fr['range_5_95'] else 'n/a'}"]
    if fb.get("fades"):
        L.append(f"Fade the BEST wallets (should lose): ROI {pct(fb['roi'])} on {fb['fades']} bets")
    lo, hi = fw["roi_ci95"]
    elo, ehi = fw["excess_ci95"]
    L += ["", "VERDICT:"]
    if lo > 0 and elo > 0:
        L.append("  Profitable, and the profit comes from WHO you fade, not just the prices. Real signal.")
    elif lo > 0:
        L.append("  Profitable, but mostly from the prices these wallets trade at (e.g. favorite-longshot bias).\n"
                 "  Buying the same-priced contracts without following anyone would do about as well.")
    elif hi < 0:
        L.append("  Loses money after costs. Fading these wallets is not a strategy on its own.")
    else:
        L.append("  Inconclusive: the confidence interval crosses zero. Needs more data before betting on it.")
    if "truth_flagged_types" in r:
        L += ["", f"(simulation) flagged wallet types: {r['truth_flagged_types']}",
              f"(simulation) population types:     {r['truth_population_types']}"]
    return "\n".join(L) + "\n"


if __name__ == "__main__":
    main()
