# Contra

**Bet against the worst.** Contra finds prediction-market wallets that keep losing bets they were sure about, and lets you take the other side from your own Solana wallet.

## What's here

| Folder | What |
|---|---|
| [`web/`](web/) | The app: Fade List, wallet pages with share images, How it works, My fades, and non-custodial trading through Jupiter's prediction API. Next.js + TypeScript. |
| [`backtest/`](backtest/) | Does fading the worst wallets make money? Downloads public Polymarket history, tests it with no lookahead and real costs, and exports the Fade List for the site. |
| [`docs/DEPLOY.md`](docs/DEPLOY.md) | Putting the site live on Vercel, keys, first live test, weekly updates. |
| [`SECURITY.md`](SECURITY.md) | How users are protected, and known limits. |

## Run the app locally

```
cd web
npm ci
cp .env.example .env.local   # optional: add keys to enable trading
npm run dev
```

Checks: `npm run check` (types, lint, tests) and `npm run build`.

## Status

- [x] Backtest engine, validated on simulated markets
- [x] Website: Fade List, wallet pages, share images, trading flow, positions and claims
- [ ] Backtest on a year of real Polymarket data
- [ ] First real Fade List published
- [ ] Deployed, with one small live trade verified
- [ ] Legal review before real money

## House rules

Wallets, not people: addresses only, never linked to identities, removed on request, never listed under 20 resolved bets. Contra never holds funds or keys.

Not financial advice. Past results don't predict future ones.
