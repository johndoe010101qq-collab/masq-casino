# MASQ / huEVO integration

Application 221, client ID `578c478ad16670b5`, draft, owned by KorolbNyboB.
Game URL: https://masq-casino.pages.dev/ . No real deposits were made.

Observed in the authenticated official developer panel on 2026-10-24:

- API root: `https://huevo.su/api/apps/v1`.
- Server authentication: Basic(client_id:client_secret). Never use in browser.
- Success `ok:true`; errors `ok:false,error:{code,message}`.
- Limits: 3000 requests/min/app; 600/min/method; 429 with Retry-After.
- Launch fields: hu_app_id, hu_user_id, hu_username, hu_display_name,
  hu_avatar, hu_mode, hu_scheme, hu_ts, hu_hash.
- Payment callbacks: raw-body HMAC-SHA256 with sha256(client_secret) key,
  X-Huevo-Signature header. At-least-once delivery; deduplicate intent_id.
- Draft payments and payouts are test-only. Wallet can be funded after approval.
- App-wallet funds may only be credited to players, not withdrawn to owner.

## Pending protocol information

The API panel exposes no method paths or request/response schemas. Obtain the
official method reference for user lookup, launch canonicalization (sorting,
encoding, timestamp tolerance, signature representation), payment intents and
confirmation flow, intent status, app-wallet credits, idempotency guarantees,
amount denomination, callback schema and test/live isolation. Do not infer
these from similarly named APIs or probe money-moving methods.

## Economics and implementation gate

Requested fixed target RTP: 97%; deposit fee: 5% of gross, explicitly quoted.
`server/huevo-economics.mjs` implements integer-only fee/credit conservation.
Map platform amount units only after their denomination is documented.

Current live MASQ is still a demo. Legacy profiles cover 50–95%; v50 adds a
fixed huEVO 97% target with independent evidence (see huevo-release-v50.md). Slot values
are empirical targets, blackjack is strategy dependent. Merely adding 97 to
the slider or relabelling the demo is NOT a validated 97% production engine.
No claim of certified exact slot/blackjack 97% is made. Complete-round v50
measurements include feature prices/bonuses and the published blackjack strategy.
Disable any history/player/bankroll-dependent reward intervention in this mode.

Production requires server-authoritative RNG, amounts, accepted rounds and
settlement, durable transactional ledger, idempotent deposit callbacks and
withdrawal reconciliation. Browser results are presentation only. Requested
absence of additional bankroll admission limits must never allow changing an
accepted outcome, fabricating funding or silently forfeiting an owed payout.

Do not publish financial activation while these gates remain incomplete.
Secrets are outside the repository and must be deployment secrets only.
