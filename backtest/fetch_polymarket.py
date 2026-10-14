#!/usr/bin/env python3
"""
Download resolved Polymarket binary markets and their taker trades.

Uses only the Python standard library, so there is nothing to install.
Polymarket's market and trade data is public; no API key is needed.

    python3 fetch_polymarket.py                  # sensible defaults (~1-3 hours)
    python3 fetch_polymarket.py --max-markets 300   # quick test run (~10 min)

Safe to stop and re-run: markets already downloaded are skipped.

Writes:
    data/markets.csv  market_id, question, slug, resolve_ts, winner_index, volume
    data/trades.csv   market_id, wallet, ts, side, outcome_index, price, size, tx
"""
import argparse
import csv
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone

GAMMA = "https://gamma-api.polymarket.com/markets"
TRADES = "https://data-api.polymarket.com/trades"
UA = {"User-Agent": "fade-backtest/0.1"}


def get_json(url, params, retries=6):
    full = url + "?" + urllib.parse.urlencode(params)
    for attempt in range(retries):
        try:
            req = urllib.request.Request(full, headers=UA)
            with urllib.request.urlopen(req, timeout=40) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504):
                time.sleep(min(60, 2 ** attempt))
                continue
            if e.code in (400, 404):
                return None  # e.g. offset past the API's paging cap
            raise
        except (urllib.error.URLError, TimeoutError, ConnectionError):
            time.sleep(min(60, 2 ** attempt))
    print(f"  giving up on {full}", file=sys.stderr)
    return None


def parse_ts(value):
    if not value:
        return None
    s = str(value).strip().replace("Z", "+00:00").replace(" ", "T")
    if len(s) >= 3 and (s[-3] in "+-") and s[-2:].isdigit():  # "+00" -> "+00:00"
        s = s + ":00"
    try:
        dt = datetime.fromisoformat(s)
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return int(dt.timestamp())


def as_list(v):
    if isinstance(v, list):
        return v
    try:
        return json.loads(v)
    except (TypeError, ValueError):
        return None


def resolved_binary(m):
    """Return (winner_index, resolve_ts) for a cleanly resolved 2-outcome market, else None."""
    outcomes, prices = as_list(m.get("outcomes")), as_list(m.get("outcomePrices"))
    if not outcomes or not prices or len(outcomes) != 2 or len(prices) != 2:
        return None
    try:
        p = [float(x) for x in prices]
    except (TypeError, ValueError):
        return None
    if p[0] >= 0.99 and p[1] <= 0.01:
        winner = 0
    elif p[1] >= 0.99 and p[0] <= 0.01:
        winner = 1
    else:
        return None  # unresolved, voided or 50/50
    ts = parse_ts(m.get("closedTime")) or parse_ts(m.get("endDate"))
    return (winner, ts) if ts else None


def fetch_markets(args):
    since = datetime.now(timezone.utc) - timedelta(days=args.days)
    out, offset = [], 0
    while len(out) < args.max_markets:
        page = get_json(GAMMA, {
            "closed": "true", "limit": 500, "offset": offset,
            "order": "volumeNum", "ascending": "false",
            "volume_num_min": args.min_volume,
            "end_date_min": since.strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
        if not page:
            break
        for m in page:
            r = resolved_binary(m)
            vol = float(m.get("volumeNum") or m.get("volume") or 0)
            if not r or vol < args.min_volume or not m.get("conditionId"):
                continue
            if r[1] < since.timestamp():
                continue
            out.append({
                "market_id": m["conditionId"],
                "question": (m.get("question") or "").replace("\n", " ")[:200],
                "slug": m.get("slug") or "",
                "resolve_ts": r[1], "winner_index": r[0], "volume": round(vol, 2),
            })
            if len(out) >= args.max_markets:
                break
        offset += 500
        print(f"  scanned {offset} closed markets, kept {len(out)}", flush=True)
    return out


def fetch_trades(market_id, max_trades):
    rows, offset = [], 0
    while offset < max_trades:
        page = get_json(TRADES, {"market": market_id, "limit": 500,
                                 "offset": offset, "takerOnly": "true"})
        if not page:
            break
        for t in page:
            try:
                rows.append([market_id, t["proxyWallet"].lower(), int(t["timestamp"]),
                             t["side"], int(t["outcomeIndex"]), float(t["price"]),
                             float(t["size"]), t.get("transactionHash", "")])
            except (KeyError, TypeError, ValueError):
                continue
        if len(page) < 500:
            break
        offset += 500
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="data")
    ap.add_argument("--days", type=int, default=365, help="markets resolved in the last N days")
    ap.add_argument("--max-markets", type=int, default=3000)
    ap.add_argument("--min-volume", type=float, default=10000, help="USDC volume floor per market")
    ap.add_argument("--max-trades", type=int, default=10000, help="trades per market cap")
    args = ap.parse_args()
    os.makedirs(args.out, exist_ok=True)

    markets_path = os.path.join(args.out, "markets.csv")
    trades_path = os.path.join(args.out, "trades.csv")
    done_path = os.path.join(args.out, ".done_markets")

    if os.path.exists(markets_path):
        with open(markets_path, encoding="utf-8") as f:
            markets = list(csv.DictReader(f))
        print(f"Using {len(markets)} markets already in {markets_path}")
    else:
        print("Finding resolved binary markets...")
        markets = fetch_markets(args)
        with open(markets_path, "w", newline="", encoding="utf-8") as f:
            w = csv.DictWriter(f, fieldnames=list(markets[0].keys()) if markets else ["market_id"])
            w.writeheader()
            w.writerows(markets)
        print(f"Saved {len(markets)} markets")

    done = set()
    if os.path.exists(done_path):
        done = set(open(done_path, encoding="utf-8").read().split())
    new_file = not os.path.exists(trades_path)
    with open(trades_path, "a", newline="", encoding="utf-8") as tf, open(done_path, "a", encoding="utf-8") as df:
        w = csv.writer(tf)
        if new_file:
            w.writerow(["market_id", "wallet", "ts", "side", "outcome_index", "price", "size", "tx"])
        todo = [m for m in markets if m["market_id"] not in done]
        for i, m in enumerate(todo, 1):
            rows = fetch_trades(m["market_id"], args.max_trades)
            w.writerows(rows)
            tf.flush()
            df.write(m["market_id"] + "\n")
            df.flush()
            if i % 25 == 0 or i == len(todo):
                print(f"  trades: {i}/{len(todo)} markets done", flush=True)
            time.sleep(0.15)
    print(f"Done. Data is in {args.out}/ - now run: python3 backtest.py --data {args.out}")


if __name__ == "__main__":
    main()
