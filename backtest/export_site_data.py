#!/usr/bin/env python3
"""
Build the website's Fade List from your downloaded data.

    python3 export_site_data.py --data data_full --results results_favorites

Scores every wallet exactly like backtest.py (z-score: how far its picks fall
below the odds, one pick per market), keeps the worst ones, looks up their
CURRENT open bets on Polymarket (public data, no key needed) and writes
../web/src/data/fade-list.json. Commit that file and the site updates.

Rules baked in (from the brand book): addresses only, never identities; a
wallet needs 20+ resolved bets in 10+ markets to be listed.
"""
import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone
from types import SimpleNamespace

import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backtest import load, wallet_stats  # noqa: E402
from fetch_polymarket import as_list, get_json  # noqa: E402

GAMMA = "https://gamma-api.polymarket.com/markets"
TRADES = "https://data-api.polymarket.com/trades"
DAY = 86400


def iso(ts):
    return datetime.fromtimestamp(int(ts), tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def lookup_markets(condition_ids):
    """conditionId -> {question, slug, outcomes, closed} from Polymarket's public market API."""
    out, ids = {}, sorted(set(condition_ids))
    for i in range(0, len(ids), 20):
        batch = ids[i:i + 20]
        # a list of pairs repeats the key: condition_ids=a&condition_ids=b...
        page = get_json(GAMMA, [("condition_ids", c) for c in batch] + [("limit", 50)])
        time.sleep(0.1)
        for m in page or []:
            outs = as_list(m.get("outcomes"))
            if m.get("conditionId") and outs and len(outs) == 2:
                out[m["conditionId"]] = {
                    "question": (m.get("question") or "").strip()[:300],
                    "slug": (m.get("slug") or "")[:200],
                    "outcomes": [str(o)[:80] for o in outs],
                    "closed": bool(m.get("closed")),
                    "active": bool(m.get("active", True)),
                }
    return out


def open_bets_for(wallet, since_ts, limit=10):
    trades = get_json(TRADES, {"user": wallet, "limit": 200, "takerOnly": "true"}) or []
    first = {}
    for t in sorted(trades, key=lambda t: int(t.get("timestamp", 0))):
        try:
            if t.get("side") != "BUY" or int(t["timestamp"]) < since_ts:
                continue
            cid = t["conditionId"]
            if cid not in first:
                first[cid] = {"conditionId": cid, "outcomeIndex": int(t["outcomeIndex"]),
                              "price": float(t["price"]), "ts": int(t["timestamp"])}
        except (KeyError, TypeError, ValueError):
            continue
    return list(first.values())[-limit:]


def bet_json(question, outcomes, idx, price):
    idx = int(idx)
    return {"question": question, "outcome": outcomes[idx], "outcomeIndex": idx,
            "otherOutcome": outcomes[1 - idx], "price": round(float(np.clip(price, 0.001, 0.999)), 4)}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--data", default="data")
    ap.add_argument("--results", default=None, help="a backtest --out folder, for the headline result")
    ap.add_argument("--out", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "web", "src", "data", "fade-list.json"))
    ap.add_argument("--window-days", type=int, default=90)
    ap.add_argument("--top", type=int, default=50)
    ap.add_argument("--min-z", type=float, default=2.0)
    ap.add_argument("--conf", type=float, default=0.80)
    ap.add_argument("--min-conf-excess", type=float, default=1.0, help="confident losses beyond what the odds implied")
    ap.add_argument("--min-fade-price", type=float, default=0.50)
    ap.add_argument("--max-fade-price", type=float, default=0.97)
    ap.add_argument("--open-days", type=int, default=14, help="how recent an open bet must be")
    ap.add_argument("--no-network", action="store_true", help="skip live lookups (testing)")
    a = ap.parse_args()

    markets, trades = load(a.data)
    buys = trades[trades.side == "BUY"]
    end = int(trades.ts.max())
    window = buys[buys.resolve_ts >= end - a.window_days * DAY]
    args = SimpleNamespace(k_usd=1000, conf=a.conf, k_conf=10, min_bets=20, min_markets=10)
    stats = wallet_stats(window, args)
    eligible = stats[stats.eligible]
    # Listed = worse than the odds overall (z) AND lost more of its high-confidence bets than the odds implied,
    # so every headline ("lost X of Y it was sure about; the odds said Z") is true and meaningful.
    flagged = eligible[(eligible.z_score <= -a.min_z) & (eligible.conf_bets >= 5)
                       & (eligible.conf_losses >= eligible.exp_conf_losses + a.min_conf_excess)].sort_values("z_score")
    top = flagged.head(a.top)
    print(f"{len(stats)} wallets scored, {len(eligible)} eligible, {len(flagged)} flagged; publishing {len(top)}")

    firsts = window[window.wallet.isin(top.index)].drop_duplicates(["wallet", "market_id"], keep="first")
    since = int(time.time()) - a.open_days * DAY
    open_raw = {}
    if not a.no_network:
        for i, w in enumerate(top.index, 1):
            open_raw[w] = open_bets_for(w, since)
            if i % 10 == 0:
                print(f"  open bets: {i}/{len(top)} wallets")
            time.sleep(0.1)

    needed = set(firsts.market_id) | {b["conditionId"] for bs in open_raw.values() for b in bs}
    info = {} if a.no_network else lookup_markets(needed)
    qmap = markets.set_index("market_id").question.to_dict()

    def labels(cid):
        return info.get(cid, {}).get("outcomes") or ["Yes", "No"]

    wallets = []
    for w, s in top.iterrows():
        f = firsts[firsts.wallet == w].sort_values("resolve_ts", ascending=False)
        recent = [dict(bet_json(qmap.get(r.market_id, "")[:300] or "Untitled market", labels(r.market_id), r.outcome_index, r.price),
                       won=bool(r.won), resolvedAt=iso(r.resolve_ts)) for r in f.head(10).itertuples()]
        conf_lost = f[(f.price >= a.conf) & (f.won == 0)]
        worst = None
        if len(conf_lost):
            r = conf_lost.sort_values("price", ascending=False).iloc[0]
            worst = dict(bet_json(qmap.get(r.market_id, "")[:300] or "Untitled market", labels(r.market_id), r.outcome_index, r.price),
                         won=False, resolvedAt=iso(r.resolve_ts))
        opens = []
        for b in open_raw.get(w, []):
            m = info.get(b["conditionId"])
            if not m or m["closed"] or not m["active"] or not m["question"]:
                continue
            opens.append(dict(bet_json(m["question"], m["outcomes"], b["outcomeIndex"], b["price"]),
                              placedAt=iso(b["ts"]), conditionId=b["conditionId"], slug=m["slug"]))
        wallets.append({
            "address": w,
            "sigma": round(float(s.z_score), 2),
            "resolvedBets": int(s.bets),
            "markets": int(s.markets),
            "confBets": int(s.conf_bets),
            "confLosses": int(s.conf_losses),
            "expectedConfLosses": round(float(s.exp_conf_losses), 2),
            "roi": round(float(s.roi), 4),
            "worstCall": worst,
            "recent": recent,
            "openBets": opens[:20],
        })

    backtest = None
    if a.results and os.path.exists(os.path.join(a.results, "results.json")):
        r = json.load(open(os.path.join(a.results, "results.json"), encoding="utf-8"))
        fw = r.get("fade_worst", {})
        if fw.get("fades"):
            backtest = {"roi": round(fw["roi"], 4), "ciLow": round(fw["roi_ci95"][0], 4), "ciHigh": round(fw["roi_ci95"][1], 4),
                        "fades": int(fw["fades"]), "days": float(r["data"]["test_window_days"])}

    out = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "sample": False,
        "windowDays": a.window_days,
        "confidencePrice": a.conf,
        "stats": {"walletsTracked": int(len(stats)), "flagged": int(len(flagged)), "backtest": backtest},
        "policy": {"minFadePrice": a.min_fade_price, "maxFadePrice": a.max_fade_price},
        "wallets": wallets,
    }
    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as fh:
        json.dump(out, fh, indent=1, ensure_ascii=False)
    n_open = sum(len(w["openBets"]) for w in wallets)
    print(f"Wrote {a.out}: {len(wallets)} wallets, {n_open} open bets to fade.")


if __name__ == "__main__":
    main()
