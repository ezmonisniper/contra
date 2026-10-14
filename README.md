# Contra

**Bet against the worst.** Contra finds prediction-market wallets whose bets go wrong more often than the odds say they should, and lets you take the other side.

## What's here

| Folder | What |
|---|---|
| [`backtest/`](backtest/) | Does fading the worst wallets actually make money? Downloads public Polymarket history and tests it with no lookahead, realistic fills and controls. Start with its README. |

## Status

- [x] Backtest engine, validated on simulated markets
- [ ] Backtest on a year of real Polymarket data
- [ ] Fade List (public leaderboard)
- [ ] Fade alerts bot
- [ ] Auto-fade (non-custodial, via DFlow / Kalshi on Solana)

## House rules

Wallets, not people: addresses only, never linked to identities, removed on request, and never listed under 20 resolved bets.

Not financial advice. Past results don't predict future ones.
