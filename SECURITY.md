# Security

## The model

**Contra never holds funds or keys.** Every trade and payout is a transaction the user signs in their own wallet. There is no hot wallet, no vault and no user database to steal from. The worst a full compromise of the website could do is show wrong information or offer a bad transaction, and the checks below make the second one hard.

## What protects users

- **Only your signature, checked twice.** Before any transaction reaches the wallet, the server and then the browser confirm that the user's own wallet is the fee payer and the only required signer. Anything else is refused.
- **Signed transactions can't be altered.** The relay only forwards transactions the wallet already signed, and any change would invalidate the signature. With `JUPITER_PREDICTION_PROGRAM_ID` set, it forwards only prediction-market transactions.
- **Server-side limits.** A per-fade cap (`CONTRA_MAX_FADE_USD`) and the fade price policy (only buying sides priced 50–97¢ by default) are enforced on the server, so a tampered page can't bypass them.
- **Secrets stay on the server.** The Jupiter API key and RPC URL never reach the browser; the browser only talks to Contra's own origin.
- **Strict Content Security Policy.** A fresh nonce on every request, with `strict-dynamic`; no inline scripts or styles without it, no third-party origins, no framing. HSTS, nosniff, a strict referrer policy and a locked-down permissions policy are also set.
- **Strict input validation.** Every API input is schema-checked (zod, unknown fields rejected), size-capped, and cross-site POSTs are refused.
- **Pinned dependencies.** Exact versions, a lockfile, `npm ci` in CI, and Dependabot for updates. CI runs typecheck, lint, tests and a production build on every push.

## Known limits

- Rate limiting is per server instance, so it blunts bursts rather than enforcing a global quota. Add Vercel's firewall rules or a shared store if abuse appears.
- `npm audit` reports advisories in transitive dependencies of the Solana wallet adapter (the React Native/Metro toolchain pulled in by the mobile adapter) and of `@solana/web3.js` (`jayson`, `uuid`, `stream-json`). None is in a code path Contra calls with untrusted input; re-check when Dependabot proposes upgrades.
- The trading integration targets Jupiter's beta prediction API. Response units are normalized defensively; verify with a small live trade (see `docs/DEPLOY.md`).

## Reporting

Email [security contact] with details. Please don't open a public issue for vulnerabilities.
