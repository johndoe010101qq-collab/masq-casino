# MASQ / huEVO preview v50

Build with `npm run build:huevo`. Ordinary development retains the Minecraft
edition; `?edition=huevo` previews the separate presentation locally.

All nine games start with the fixed public 97% target. The session rejects
changes to another RTP; the huEVO build exposes no demo RTP editor. RNG and
weights are independent of account identity, stakes, bankroll and history.
No retention/reward intervention is called by this edition.

Coinflip, Dice, Roulette, Plinko and Upgrader use complete integer ticket maps
with exact expected gross return of .97 at supported stakes (exhaustively
checked). Faces and pockets are drawn before presentation, never corrected
after a result. Blackjack uses the existing six-deck engine: uniform player
draws, fixed disclosed 100/10000 dealer preferred-card branch, ordinary payouts.
One million calibration hands preceded a separate one-million-hand holdout;
the latter returned 96.8882%, 95% CI [96.6952%,97.0812%], for the documented
hit/stand strategy. Blackjack return depends on strategy.

Slots preserve complete native rounds, price, symbol pays and bonuses. Their
fixed whole-round weights target .97 using the pinned baseline calibration.
These are statistical targets, not certified exact theoretical RTP. Independent
full-round estimates, confidence intervals, positive/profitable frequencies,
observed tails and sampling error are in `huevo-slot-97-holdout.json` and in
the in-app rules. No repeat was selected to improve the observed return.
The 50–95 legacy sampler and its evidence remain byte-for-byte intact.

The platform still has no authoritative wallet connection: this is a demo
preview, with that limitation visible in the product. Deposit quote code is
tested but no platform money is moved. Actual launch verification, payments,
server game settlement and financial activation await the huEVO API protocol.
The 5% deposit fee is separate from RTP and must be disclosed before payment.

## Visual changes

Separate candy, dog and Paris-heist backgrounds and twelve-symbol atlases.
No Minecraft slot scenes, masks or mascot layers in this edition; classical
games and supplied dealer footage retain their existing visuals. Reel cells,
accepted outcomes and playback clocks are unchanged. Controls sit below the
field; mobile has a compact stake/spin/balance layout. Catalogue cards match.

All nine new WebP assets are project-owned generated raster illustrations,
not extracted files from third-party slots. Native source rectangles and
packing metadata are in `studio-slots-v50-packing.json`. All symbols are packed
into square cells with transparent margins to avoid adjacent-sprite bleed.

Generation used the built-in imagegen skill. Prompt set: (1) candy atlas,
4x3 isolated blue/green/purple/heart sweets, bananas/plums/apple/watermelon,
grapes/lollipop/star/candy bomb; transparent, painted 2D, no mask or voxel.
(2) dog atlas, four friendly breeds, collar/bone/A/K/Q/house/paw/treat;
transparent, isolated painted symbols. (3) Paris atlas, gloves/hat/notebook/map,
watch/pouch/espresso/key/coin/dossier/raccoon medallion/decoder; painted ink
illustration, no text or brand. Background prompts: original 16:9 candy valley,
sunlit cottage garden, and blue-hour Paris street respectively; scenery only
at edges, quiet central 82%, no reel frame, mascot, logos or text.

Public assets: `public/studio-slots-v50/`. Proof screenshots are outside the
public repository, under the task's outputs/studio-slots-v50 directory.
