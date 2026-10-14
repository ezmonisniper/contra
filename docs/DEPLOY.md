# Deploying Contra

About 20 minutes, done once. Afterwards, every push to `main` redeploys automatically.

## 1. Accounts and keys (all free to start)

| What | Where | Used for |
|---|---|---|
| Vercel | vercel.com, sign in with GitHub | Hosting |
| Jupiter API key | developers.jup.ag/portal | Prices, orders, positions |
| Helius RPC key | helius.dev | Sending signed transactions to Solana |

Vercel's free Hobby plan is for non-commercial use. It's fine for building and testing. Once Contra earns money, move to Vercel Pro (about $20/month).

## 2. Import the project

1. In Vercel, click **Add New → Project** and pick the `contra` repo.
2. Set **Root Directory** to `web`. Everything else stays default.
3. Under **Environment Variables**, add:
   - `JUPITER_API_KEY`: your Jupiter key
   - `SOLANA_RPC_URL`: `https://mainnet.helius-rpc.com/?api-key=YOUR_KEY`
   - `CONTRA_MAX_FADE_USD`: `25` to start
   - `NEXT_PUBLIC_SITE_URL`: your Vercel URL for now, e.g. `https://contra-xyz.vercel.app`
4. Click **Deploy**.

Leave `JUPITER_API_KEY` out and the site still runs: the Fade List works, and the Fade buttons say trading isn't switched on yet.

## 3. First live test (do this before telling anyone)

The trading path is fully tested against simulated responses, but not yet against Jupiter's live API. Do one tiny real trade yourself:

1. Publish a real Fade List (step 5) so fades are enabled.
2. Connect a wallet holding a few dollars of USDC and a little SOL for fees.
3. Fade one open bet for **$1–2**. Check the "Your side" price matches the market on Polymarket, then confirm.
4. Check the order appears in **My fades**, and later claim it if it wins.
5. Open the transaction on Solscan, copy the **program id** it called, and set `JUPITER_PREDICTION_PROGRAM_ID` in Vercel. From then on the relay forwards only prediction-market transactions.

If something fails, the error shown on the page is the upstream reason (often eligibility or a closed market). Send it to Claude.

## 4. Your domain

Vercel → Project → **Domains** → add yours, then update `NEXT_PUBLIC_SITE_URL`.

## 5. Publishing the Fade List (weekly)

On your computer, in the `backtest` folder:

```
python fetch_polymarket.py --out data_full         # refresh the data
python backtest.py --data data_full --min-price 0.5 --out results_favorites
python export_site_data.py --data data_full --results results_favorites
```

This writes `web/src/data/fade-list.json` with `"sample": false`. Commit and push it, and Vercel redeploys with the new list.

## Before real money: the checklist

- [ ] The full-year backtest supports fading (see `backtest/` README)
- [ ] A lawyer has reviewed `/legal` and your eligibility setup (Polymarket isn't available to US users; Kalshi has its own rules)
- [ ] Bracketed items on `/legal` filled in (contact email, entity, date)
- [ ] First live test done, program id locked
- [ ] `CONTRA_MAX_FADE_USD` set to a level you're comfortable with
