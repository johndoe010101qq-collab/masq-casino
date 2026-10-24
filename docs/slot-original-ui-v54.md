# MASQ: original slot interface adaptation and huEVO 92%

Requested on 2026-10-24. The current huEVO target is **92%**, replacing 97%. Deposit fee remains **5%**: 100 platform coins deposit credits 95 game coins.

## Implemented

- Bonanza uses the original Sweet Bonanza raster fruit/candy textures, candy landscape, title fragment, start composition and purple purchase panels. The old mask fallback cannot mount in the huEVO entrance screen.
- LeXof uses the original Le Bandit regular symbols, FS camera, rainbow, coins, clover, pot and Paris background. The four-card bonus menu follows the original white panels and orange/green action buttons; stake changes update displayed prices.
- Mask House keeps its dog-house composition and has one bonus confirmation, its 3×3 free-spin reveal, Sticky Wild state, free-spin counter and themed result panel.
- Each game has paged paytables/rules and its own bet/spin panel. All huEVO amounts use монэтки. Speed choices are normal / quick / turbo; turbo scales presentation by four without changing the accepted round.
- Visible autoplay controls have no finite spin selector. Autoplay runs until Stop, insufficient balance or an existing blocking condition. Stop never changes an accepted result.
- Manually launched bonuses wait for Continue at entry and summary. Autoplay progresses automatically through these screens. Bought bonus and LeXof feature modes remain selected until canceled.
- The lobby payout overlay is suppressed for huEVO slots; the game's own readouts show the accepted amounts.
- Client and server pin the current 92% profile. A previously accepted Blackjack hand replays with the exact draw parameters stored in its receipt, including old 97% hands.

## Mathematical scope

This is a MASQ interface adaptation, not the providers' game software or certified mathematics. Existing MASQ prices, paytables, caps and whole-round calibration remain explicit in the rules. In particular, the current Bonanza purchase is ×50, LeXof purchases are ×20/×25 and Rainbow FeatureSpins are ×10. Original provider prices differ. Original Sweet Bonanza's Double Chance mode and proprietary provider RNG distributions are not implemented by this UI release.

The 92% slot setting uses the existing frozen full-candidate calibration, including separately accounted purchase minimums. Classic one-ticket games use exhaustive exact maps. Blackjack uses the already frozen 607/10000 dealer and 284/10000 player branch parameters; its RTP is approximate and depends on decisions. Independent evidence is in `huevo-slot-92-holdout.json` and `huevo-blackjack-92-holdout.json`.

## Reference and validation

Primary visual references: https://www.pragmaticplay.com/en/games/sweet-bonanza-slot/ , https://www.pragmaticplay.com/en/games/the-dog-house-slot/ , https://www.hacksawgaming.com/games/le-bandit . Raster provenance is recorded in `public/original-slots-v54/provenance.json`.

Checks cover turbo result identity, bonus gates and unmount, resumable clocks, continuous/async autoplay, full-cost selected modes, native gravity/Sticky Wild/collection playback, exact ticket sums, fixed policy, signed server sessions, deposit conservation, idempotency and old-profile Blackjack replay. Browser checks use standalone demonstration balances, including desktop and 390px layouts. No real platform transfers are part of verification.
