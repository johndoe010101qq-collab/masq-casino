import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { COIN_FILM as film, coinFilmAcceptedFace, coinFilmPresentation } from '../src/coin-film-presentation.js';

let checks = 0;
const equal = (actual, expected, message) => { assert.equal(actual, expected, message); checks++; };
const poseAt = (face, frame, options = {}) => coinFilmPresentation(face, frame / film.lastFrame,
  options.playing ?? true, options.reduced ?? false);

equal(coinFilmAcceptedFace(null), null);
equal(coinFilmAcceptedFace({ face: 'unexpected' }), null);
let reads = 0;
const round = Object.defineProperty({ id: 'accepted' }, 'face', { get() { reads++; return 'heads'; } });
for (const key of ['won', 'payout', 'stake', 'choice', 'ticket', 'chanceFraction'])
  Object.defineProperty(round, key, { get() { throw new Error('Presentation read financial information: ' + key); } });
equal(coinFilmAcceptedFace(round), 'heads');
equal(reads, 1, 'Read only the already accepted face');

for (const face of ['heads', 'tails']) {
  const first = poseAt(face, 0);
  equal(first.clip(false), 'toss_' + face);
  equal(first.clip(true), 'toss_' + face);
  equal(first.camera(true).scale, 1);
  equal(first.settled, false);
  equal(poseAt(face, 9.999).clip(false), 'toss_' + face);
  equal(poseAt(face, 10).clip(false), 'toss_' + face + '_close', 'Intentional flick cut uses absolute time');
  equal(poseAt(face, 10).clip(true), 'toss_' + face + '_close', 'Mobile cuts to its actual raster macro at the same flick');
  equal(poseAt(face, 12).phase, 'toss');
  equal(poseAt(face, film.settled[face] - .001).settled, false);
  equal(poseAt(face, film.settled[face]).settled, true, 'Actual film settlement marker');
  equal(poseAt(face, 60).camera(true).scale, 1);
  for (let frame = 0; frame <= film.lastFrame; frame++) {
    const pose = poseAt(face, frame), mobile = pose.camera(true), desktop = pose.camera(false);
    equal(mobile.scale, 1, 'Mobile macro is encoded from the full resolution master, not enlarged tiny wide coin');
    assert.ok(Number.isFinite(mobile.originX) && Number.isFinite(mobile.originY));
    assert.ok(mobile.originX >= 0 && mobile.originX <= 720 && mobile.originY >= 0 && mobile.originY <= 960);
    equal(desktop.scale, 1, 'Desktop close-up is native footage, not double zoomed');
    equal(pose.progress, frame / film.lastFrame, 'Public progress is preserved');
    checks += 2;
  }
  for (const pose of [coinFilmPresentation(face, 1, true), coinFilmPresentation(face, .2, false),
    coinFilmPresentation(face, .2, true, true)]) {
    equal(pose.frame, film.lastFrame, 'Skip, completed and reduced-motion all show the accepted final frame');
    equal(pose.settled, true);
    equal(pose.clip(false), `toss_${face}_close`);
    equal(pose.clip(true), `toss_${face}_close`);
    equal(pose.face, face);
  }
  equal(coinFilmPresentation(face, NaN, true).progress, 0);
  equal(coinFilmPresentation(face, -10, true).progress, 0);
  equal(coinFilmPresentation(face, 10, true).progress, 1);
}

for (const face of [null, undefined, '', 'red', 1]) {
  const pose = coinFilmPresentation(face, 1, true, true);
  equal(pose.clip(false), 'idle'); equal(pose.clip(true), 'idle');
  equal(pose.phase, 'idle'); equal(pose.settled, false); equal(pose.camera(true).scale, 1);
}

// Check the actual shipped inventory: every accepted side has its own master,
// macro and mobile film, and both views have a poster for media failures.
for (const view of ['desktop', 'mobile']) {
  for (const clip of ['idle', 'toss_heads', 'toss_tails', 'toss_heads_close', 'toss_tails_close']) {
    const path = new URL(`../public/classic-films-v47/coinflip/${view}/${clip}.mp4`, import.meta.url);
    assert.ok((await stat(path)).size > 1000);
    const header = await readFile(path);
    assert.equal(header.subarray(4, 8).toString(), 'ftyp'); checks += 2;
  }
  const poster = await readFile(new URL(`../public/classic-films-v47/coinflip/${view}/poster.webp`, import.meta.url));
  equal(poster.subarray(0, 4).toString(), 'RIFF'); equal(poster.subarray(8, 12).toString(), 'WEBP');
}
console.log(`Coinflip film: ${checks} checks passed; both accepted faces, physical reveal markers, desktop cut, mobile macro, skip and reduced motion.`);
