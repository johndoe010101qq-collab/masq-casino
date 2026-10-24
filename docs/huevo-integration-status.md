# MASQ / huEVO integration — v52

Application 221, public client ID `578c478ad16670b5`, owned by KorolbNyboB.
Game URL: https://masq-casino.pages.dev/ . Developer: deathlain.

## Official protocol

The owner supplied https://t.me/huevodev on 2026-10-24. Its announcement links
https://huevo-docs.lunnaholy.workers.dev/apps/ . This replaces the previous
missing-method-documentation blocker.

- Launch verification: all decoded hu_* fields except hu_hash, sorted by key,
  joined with newlines; HMAC-SHA256 using binary SHA256(client_secret).
  The server checks app 221, timestamp freshness, user ID and signed test/live mode.
- The frontend loads the official SDK from https://huevo.su/static/js/huevo-apps-v1.js.
  SDK messages and init data alone never authenticate or credit a wallet.
- Server Basic authentication calls `/payments`, `/payments/{intent_id}` and
  `/credits`. Platform amounts are whole monétkas. Our ledger uses hundredths:
  1 internal AR = 1 platform coin; fractions remain in the account until playable
  or withdrawable as whole coins.
- `/wallet` is the APPLICATION wallet, never the player's casino balance.
- Deposits are credited only after server GET confirmation of succeeded and
  exact user, amount and mode match. A 100-coin deposit credits 95.00, fee 5.00.
- Withdrawals debit the internal ledger atomically before the platform credit.
  An uncertain response retains the pending hold and reuses the platform key.
  Definite rejection refunds once; success can never pay twice.
- Callback handler `/api/huevo/callback` verifies raw-body HMAC, app and mode,
  then reconciles through the API. The callback URL has been saved in the
  platform developer panel. Active polling and login recovery also cover
  missed callbacks.

## Deployed server

Cloudflare Pages Functions with D1 database `masq-huevo` (separate test/live
owner keys, SQL transactions and optimistic revision guards). The browser
cannot supply results or payouts: all nine game engines run on the server.
Complete slot results are committed with the balance before they are returned.
Blackjack stores a private RNG tape and action history for exact recovery;
only public cards reach the browser. Completed animations merely reveal the
already committed funds. Closing/reloading cannot reroll an accepted round.

Client secret is an encrypted server deployment secret, outside source control.
`HUEVO_LIVE_ENABLED=false` in BOTH environments. Draft platform launches also
force test mode. Standalone browsing remains explicitly nonredeemable demo.

The platform frame is configured as large, 3:2 to fit the game canvas.

## Verified 2026-10-24

- Local SQLite tests: signature tampering, duplicates/future/old launch fields,
  test/live separation, deposit deduplication, wrong-owner rejection, idempotent
  rounds, blackjack replay after service restart, uncertain withdrawal recovery,
  definite rejection refund, SQL rollback and asynchronous card presentation.
- Production: health configured=true, liveEnabled=false; forged login HTTP 401.
- Real signed huEVO iframe launch authenticated successfully.
- Official TEST payment dialog showed 100 requested, 5 fee, 95 credited.
  Confirmed test payment produced an internal balance of 95.00.
- A TEST Mask House round used the authoritative ledger: stake 5.00, payout
  14.70, balance 104.70. Test withdrawal 5.00 succeeded; reload kept 99.70.
- Native iframe blackjack also completed a funded TEST deal, hit, stand, dealer
  reveal/draw and final settlement through asynchronous server transitions.
- Read-only application wallet API returned balance 0 and frozen=false.
  No real payment, payout or funding operation was performed.

## Economics and remaining publication gate

Fixed public target RTP 97%, deposit fee 5%, no personalized outcome adjustment.
Classic ticket maps are exhaustive; blackjack and slots have independent
holdout evidence and are empirical targets, not a certified exact 97% theorem.
See huevo-release-v50.md and its measurement files.

App remains unpublished on huEVO, visible only to owner/testers/admins. A live
launch, real transfers and production capacity acceptance are separate from
this test integration. Do not enable the live flag until platform moderation
and real deployment acceptance have been completed. Free Cloudflare quotas
are finite; no paid plan or new bankroll/outcome adjustment was enabled.
