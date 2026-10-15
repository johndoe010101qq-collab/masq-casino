import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

// Load the actual JSX module through the project's installed transformer. This
// exercises its exported layout contract without a browser or media playback.
const server = await createServer({ configFile: false, appType: 'custom', logLevel: 'error',
  root: fileURLToPath(new URL('..', import.meta.url)),
  server: { middlewareMode: true }, clearScreen: false });
let checks = 0;
const close = (actual, expected, message) => { assert.ok(Math.abs(actual - expected) < 1e-8, `${message}: ${actual} / ${expected}`); checks++; };
try {
  const { classicFilmProjection, classicFilmChildLayout } = await server.ssrLoadModule('/src/ClassicFilmStage.jsx');
  const fixtures = [
    { width: 1280, height: 720, mobile: false, sw: 1920, sh: 1080, factor: 2 / 3, x: 0 },
    { width: 740, height: 528, mobile: false, sw: 1920, sh: 1080, factor: 22 / 45, x: -99.33333333333331 },
    { width: 390, height: 520, mobile: true, sw: 720, sh: 960, factor: 13 / 24, x: 0 },
    { width: 330, height: 300, mobile: true, sw: 720, sh: 960, factor: 5 / 16, x: 52.5 },
    { width: 1920, height: 500, mobile: false, sw: 1920, sh: 1080, factor: 25 / 54, x: 515.5555555555555 },
  ];
  for (const fixture of fixtures) {
    const actual = classicFilmProjection(fixture.width, fixture.height, fixture.mobile);
    const legacy = classicFilmChildLayout(actual);
    assert.equal(legacy, actual, 'Opt-in false preserves the exact legacy layout object'); checks++;
    close(actual.factor, fixture.factor, 'One source-to-stage scale'); close(actual.x, fixture.x, 'One source-to-stage offset');
    const native = classicFilmChildLayout(actual, true);
    assert.deepEqual(native, { mobile: fixture.mobile, sourceWidth: fixture.sw, sourceHeight: fixture.sh,
      width: fixture.sw, height: fixture.sh, x: 0, y: 0, factor: 1,
      viewportFactor: actual.factor, viewportWidth: fixture.width, viewportHeight: fixture.height }); checks++;
    close(actual.x + native.width / 2 * actual.factor, fixture.width / 2, 'Native source centre remains stage centre');
    close(native.height * actual.factor, fixture.height, 'Native media and projected overlays share the exact stage height');
    for (const sourcePoint of [[0, 0], [fixture.sw / 2, fixture.sh / 2], [fixture.sw, fixture.sh], [fixture.sw * .37, fixture.sh * .71]]) {
      // The same source point must meet whether it comes from the fixed media
      // layer or from children using the onLayout native coordinate contract.
      const throughChild = [native.x + sourcePoint[0] * native.factor, native.y + sourcePoint[1] * native.factor];
      close(actual.x + throughChild[0] * actual.factor, fixture.x + sourcePoint[0] * fixture.factor, 'Overlay/media X alignment');
      close(actual.y + throughChild[1] * actual.factor, sourcePoint[1] * fixture.factor, 'Overlay/media Y alignment');
    }
  }
  console.log(`Classic film source geometry: ${checks} checks passed; fixed native layers, both views, cropped and letterboxed stages, unchanged opt-out.`);
} finally { await server.close(); }
