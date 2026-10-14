# Fade the Worst — backtest

Would betting AGAINST the worst prediction-market traders have made money?

## Run it (any computer with Python 3.9+)

```bash
pip install pandas numpy
python3 fetch_polymarket.py --max-markets 300   # quick test, ~10 min
python3 backtest.py --data data
```

For the real answer, run the downloader with defaults (last 365 days, up to 3,000
resolved markets with $10k+ volume; takes 1–3 hours, safe to stop and resume):

```bash
python3 fetch_polymarket.py
python3 backtest.py --data data
python3 backtest.py --data data --rank-by shame --out results_shame   # the "confidently wrong" metric
```

Results land in `results/`: `report.txt` (start here), `wall_of_shame.csv`,
`fades.csv`, `results.json`.

## How it works

- **No lookahead.** Every week the worst wallets are re-ranked using only markets
  that had already resolved. Their next buys are faded by buying the opposite outcome.
- **Ranking.** Default is a z-score: how many standard deviations a wallet's picks
  did worse than the odds implied (one pick per market). Alternatives: `edge`
  (dollar ROI) and `shame` (high-confidence bets lost vs. what the odds implied).
- **Realistic fills.** We act 5 seconds later and pay the next traded price, plus a
  1-cent half-spread (`--delay`, `--half-spread`, `--fee`).
- **Controls.** (1) Fading random wallets. (2) Fading the *best* wallets (should
  lose). (3) A same-price control: what you'd earn buying contracts at the same
  prices without following anyone. Only profit above (3) is real "fade" signal;
  the rest is the favorite-longshot bias.
- **Uncertainty.** 95% intervals are bootstrapped by market, because bets on the
  same market aren't independent.

## Validated on simulated markets (`simulate.py`)

| World | What's true | Backtest said |
|---|---|---|
| null | Nobody has an edge | Inconclusive / loses, in 9 of 9 runs. No false alarms |
| antiskill | 5% of wallets truly pick losers | +14.7% ROI, +18.9% edge over control (CI +13% to +24%). Real signal found |
| longshot | Bad wallets just overpay for long shots | Edge over control ≈ 0. Correctly says following them adds nothing beyond price |

## Caveats

- Only taker trades; sells are ignored and P&L assumes holding to resolution.
- Binary markets only.
- Polymarket now charges taker fees on some markets; set `--fee` if you test those.
- Past results don't guarantee future ones. This is research, not financial advice.
