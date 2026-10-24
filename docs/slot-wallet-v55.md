# Slot controls and huEVO wallet — 2026-10-25

- Raster Bonanza entry/exit durations and stagger now follow 1× / 2× / 4×.
  Previously the timeline scaled while the visible reels still used 920 ms.
- In-flight speed changes retime the remaining presentation, including Mask
  House and LeXof. Accepted grids, RNG, payout, RTP and ledger are unchanged.
- Bonanza uses a dark control rail, bounded balance/win areas, readable menu
  buttons and a narrow-screen paytable. Redundant autoplay and floor-payment
  overlays are omitted; the actual bonus total and published terms remain.
- The header exposes Пополнить. Standalone demo asks for a huEVO launch;
  it cannot convert demo credits or create an authenticated wallet itself.
- Signed huEVO launches open deposit/withdraw tabs, amount presets, a 5% fee
  quote and final net credit. Only reconciled server receipts update balances.
  Retry reuses the operation key; checking status does not repeat approval.
- Production accepts valid signed live launches; preview remains live-disabled.
  App 221 is currently unpublished according to its platform page, so huEVO
  itself forces TEST mode. Enabling production support does not publish the
  app or move any funds. No real transfer was performed during this change.
- Target RTP remains 92%; deposit fee remains 5%.

Validation: build:huevo, server/async-autoplay suite, wallet operation cases,
Bonanza presentation and slot integration checks; browser desktop/mobile and
computed 230 ms turbo raster duration. Financial tests use isolated fixtures.
