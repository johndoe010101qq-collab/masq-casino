# Mask House reference layout

Latest direction supersedes the generic v50 dog-slot layout. Match the supplied
1258x850 screenshot: the wooden house, five reels, large letter/number/dog
symbols, grass footer, left credit/stake, central actual payout, right spin,
stake minus/plus and autoplay pill. Only the top name is MASK HOUSE.

Scene and symbol images were derived with built-in imagegen from the user's
uploaded screenshot. Background edit prompt: preserve all scenery, roof, wooden
sign, field and grass positions; remove reel icons, title text and footer UI;
reconstruct clean wood/grass. Symbol edit prompt: preserve the visible reference
drawings in a transparent 4x3 atlas: framed rottweiler/Yorkshire/dachshund, bone,
A/K/Q/10/J, bonus paw, house without baked multiplier, collar. These are image
transformations of the provided reference, not extracted provider executables.

Assets are `public/doghouse-reference-v51/scene.webp` and `symbols.webp`.
Native rectangles and field/title coordinates are in the sibling layout JSON.
Original title, amounts and controls are not baked into these assets.

DoghouseControls operates the same accepted session and autoplay controller:
stake settings, +/- steps, manual spin, animation skip, turbo, autoplay count,
until-balance option, stop, rules and bonus purchase. No RNG or wallet mutations
are added to presentation. A 2X/3X label uses the actual accepted wild value.
The idle reference grid is decorative only; it never awards or simulates a win.
Portrait art is renamed to the existing stable symbol IDs; the nine-symbol
engine, 20 lines and fixed huEVO97 target are unchanged.

RTP limitations and measurements remain documented in huevo-release-v50.md.
There is no claim that MASQ runs the provider's original mathematics.
Financial huEVO integration is still pending its API documentation.

Open directly with `?game=maskhouse` in a huEVO build, or
`?edition=huevo&game=maskhouse` on the development server.
