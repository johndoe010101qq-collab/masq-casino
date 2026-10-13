# MASQ slot animation brief

Animate the three supplied slot scenes and mascots for the MASQ casino. Each game needs its own atmosphere and character. Use the current raster plates and character pose sheets as the visual references. Keep the existing Blackjack videos unchanged.

## Art direction

**Bonanza:** a moonlit fruit and candy garden with cyan light, warm lanterns and lively painted colors. The host is our black hooded Minecraft character wearing the simple green fruit apron. Preserve the corrected ivory pixel mask and block anatomy shown in the pose sheet. Keep the same outfit throughout.

**Mask Hou$e:** a burgundy velvet theatre with restrained brass framing and warm stage lights. The host is our black hooded Minecraft character with the burgundy scarf and cape. Preserve the corrected pixel mask, hood and proportions. No tuxedo or tailcoat.

**LeXof:** a Paris rooftop hideout at night, with navy, teal, burgundy and brass. The character is the supplied orange fox with a teal hood, burgundy scarf and Anonymous mask. Keep the ears, single tail and costume consistent. Preserve the painted character design; do not replace it with a human.

Keep the raster drawing style, broad readable forms and material colors. Do not turn the slot symbols into generic 3D objects. The animation should add character and depth through movement, lighting and composition.

## Scene and camera

Desktop clips: 1920×1200, 30 fps, H.264 MP4, yuv420p. Use one fixed camera for every clip of a game. Match the reference scene precisely; no cuts, zooms, shake or moving reel frame.

Keep the reel field empty. The application draws the real symbols, values, multipliers and typography. Do not bake any words, numbers, buttons, cards, logos or winnings into the footage. The title plate and lower readout area must also stay empty.

The supplied plates have the following measured empty panel rectangles. Scale them proportionally when rendering at 1920×1200 and include the exact final rectangles in your layout JSON.

| Game | Reference image size | Empty panel rectangle, x y width height |
|---|---|---|
| Bonanza | 1586×992 | 448 142 964 543 |
| Mask Hou$e | 1585×992 | 444 148 960 532 |
| LeXof | 1586×992 | 440 143 1014 559 |

Place the complete mascot in the left area, clear of the reel field and title. Keep both hands, feet and the fox tail intact. Every action must remain inside this character area.

Also make a mobile composition at 720×816, 30 fps. Place the mascot above the full reel field; keep all six or five columns visible. Provide a separate mobile layout JSON. Do not crop away the character or stretch the desktop scene.

## Clips for each game

- `idle.mp4`: 8–10 seconds, seamless loop. Gentle breathing, a brief glance at the reel field and a small hand or shoulder movement.
- `spin.mp4`: 1.2–1.8 seconds. A short anticipatory gesture towards the field. Do not imply a result.
- `win.mp4`: 2.5–3 seconds. A delighted nod and one compact celebration.
- `big_win.mp4`: 3–4 seconds. A brief dance or two playful celebration beats, using the character's actual body rather than moving a still cutout.
- `bonus.mp4`: 2–3 seconds. Surprise followed by a welcoming gesture towards the blank field.
- `lose.mp4`: 1.8–2.5 seconds. A short teasing head tilt or shrug.

Only idle loops. Every action clip starts and ends in exactly the same neutral pose as idle frame 0. Keep the face pattern, clothing, lighting and furniture consistent. Finish each gesture before returning to neutral.

## Files to deliver

For each game, provide `desktop/`, `mobile/`, `layout/`, `marks/`, `frames/` and `source/` directories. Include the editable character and scene source, frame counts and exact durations, first and last PNG frames, and a loop-boundary comparison.

Provide frame-indexed event markers for gesture peaks and return to neutral, plus head and hand positions in native screen pixels. Use zero-based frame numbers and timestamps calculated from frames / 30. The application will trigger reactions only after the actual game result is public.

Start with one finished Mask Hou$e desktop idle preview and its layout guide, using the current burgundy scene and corrected hooded character.

