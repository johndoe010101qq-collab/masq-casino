const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export const COIN_FILM = Object.freeze({
  fps: 30, frames: 138, lastFrame: 137, duration: 4.6,
  cutFrame: 10, releaseFrame: 12, apexFrame: 29, contactFrame: 49,
  settled: Object.freeze({ heads: 92, tails: 88 }),
  resultHoldEnd: Object.freeze({ heads: 128, tails: 124 }),
});

// Read the accepted face once, when a round is received. The filmed variants
// have different physical spins from release onward; they are not a shared
// pre-reveal animation. They never select, retry or settle a game result.
export function coinFilmAcceptedFace(round) {
  if (!round) return null;
  const face = round.face;
  return face === 'heads' || face === 'tails' ? face : null;
}

export function coinFilmPresentation(face, progress, playing, reduced = false) {
  const accepted = face === 'heads' || face === 'tails';
  const p = accepted ? reduced || !playing ? 1 : clamp(progress) : 0;
  const frame = p * COIN_FILM.lastFrame;
  const settled = accepted && frame >= COIN_FILM.settled[face];
  const cut = accepted && frame >= COIN_FILM.cutFrame;

  return Object.freeze({
    face: accepted ? face : null, progress: p, frame, settled,
    phase: !accepted ? 'idle' : settled ? 'result' : frame < 12 ? 'held' : 'toss',
    // The desktop close-up starts from a different camera. Cut on the wrist
    // flick, carrying the same media time; never restart it from frame zero.
    clip: () => !accepted ? 'idle' : `toss_${face}${cut ? '_close' : ''}`,
    // Mobile macros are centred 810x1080 raster crops of the supplied master
    // close-ups, resized to 720x960. The physical face, shadow and felt remain
    // in the filmed image; no separate face or result overlay is drawn.
    camera: mobile => Object.freeze({ scale: 1, originX: mobile ? 360 : 960, originY: mobile ? 480 : 540 }),
  });
}
