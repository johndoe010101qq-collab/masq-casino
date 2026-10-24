# MASQ huEVO server v52

Production: https://masq-casino.pages.dev/
Platform: https://huevo.su/apps/221

Build: `npm run build:huevo`.
Checks: `npm run test:huevo` and `npm run test:huevo:server` (Node 24 SQLite).
Deploy: `wrangler pages deploy dist --project-name masq-casino --branch main`.
Preview uses `--branch huevo-preview`. Never put client_secret into VITE variables.

Schema: server/huevo-schema.sql. D1 binding HUEVO_DB. Both deployment environments
are declared in wrangler.jsonc. Fresh installs require this schema before login.
Server-only HUEVO_CLIENT_SECRET must be provisioned with Pages secrets. Public
HUEVO_APP_ID and HUEVO_CLIENT_ID do not grant any privileges on their own.

Routes (same origin, bearer sessions, no CORS wildcard):
- GET /api/huevo/health: boolean configuration/live status only.
- POST /api/huevo/login: signed launch query -> 12h session and wallet.
- GET /api/huevo/session: wallet, configuration, recoverable blackjack/pending transfer.
- POST /api/huevo/rounds: public bet choice -> committed complete round.
- POST /api/huevo/blackjack: versioned public action -> committed hand transition.
- GET /api/huevo/operations/{id}: own accepted operation recovery only.
- POST /api/huevo/deposits: stable intent key, whole-coin amount -> official dialog ID.
- POST /api/huevo/deposits/{intent}: server API reconciliation and exact-once 95% credit.
- POST /api/huevo/withdrawals: atomic debit, idempotent platform credit and recovery.
- POST /api/huevo/callback: raw-body signature, API reconciliation, 204 acknowledgement.

The platform callback is configured in the developer panel as
https://masq-casino.pages.dev/api/huevo/callback. Never include a
secret/token in this URL. Reload reconciliation also handles missing callbacks.

No paid service upgrade, real transfer or application review submission is part
of this deployment. HUEVO_LIVE_ENABLED remains false. Test and live SQL account
keys are separate even for the same user ID; test value is never redeemable.

Keep D1 backups and operation receipts. Never clear a pending withdrawal after a
network timeout: replay the same idempotency key. Do not reset funded blackjack
hands; the private stored tape reconstructs the exact previously accepted hand.
A database conflict rolls back the entire operation; retry with the same ID.
