import assert from 'node:assert/strict';
import { createClassicFilmPlayback, classicFilmTime } from '../src/classic-film-playback.js';

let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const close = (actual, expected, message) => { assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual} / ${expected}`); checks++; };
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

class VideoProbe {
  listeners = new Map(); attributes = new Map(); requests = []; seeks = [];
  readyState = 0; duration = NaN; paused = true; seeking = false;
  pauseCount = 0; loadCount = 0; muted = false; defaultMuted = false; loop = false;
  time = 0; throwSeek = false; throwPlay = false;
  addEventListener(type, callback) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback) {
    const group = this.listeners.get(type); group?.delete(callback);
    if (group?.size === 0) this.listeners.delete(type);
  }
  emit(type) { for (const callback of [...this.listeners.get(type) ?? []]) callback({ type }); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  get currentTime() { return this.time; }
  set currentTime(value) {
    if (this.throwSeek) throw new Error('Decoder refused seek');
    this.time = value; this.seeking = true; this.seeks.push(value);
  }
  load() {
    this.loadCount++; this.readyState = 0; this.duration = NaN;
    this.time = 0; this.seeking = false; this.paused = true;
  }
  pause() { this.pauseCount++; this.paused = true; this.emit('pause'); }
  play() {
    if (this.throwPlay) throw new Error('Autoplay unavailable');
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    this.requests.push({ resolve, reject }); return promise;
  }
  metadata(duration = 4.6) { this.duration = duration; this.readyState = 1; this.emit('loadedmetadata'); }
  decode() { this.readyState = 2; this.seeking = false; this.emit('seeked'); }
  fulfill(index, event = true) {
    this.paused = false; this.readyState = 2; this.requests[index].resolve();
    if (event) this.emit('playing');
  }
}

const intent = (clip = 'toss_heads', progress = 0, extra = {}) => ({
  src: `/coinflip/desktop/${clip}.mp4`, token: 'round-1', idle: clip === 'idle',
  progress, reduced: false, visible: true, ...extra,
});
function harness(videos = [new VideoProbe(), new VideoProbe()]) {
  const states = [], frames = []; let settlements = 0;
  const player = createClassicFilmPlayback({ videos, onState: state => states.push(state),
    onFrame: value => frames.push(value), onComplete: () => settlements++ });
  return { player, videos, states, frames, settlements: () => settlements };
}

assert.throws(() => createClassicFilmPlayback({ videos: [] }), TypeError); checks++;
assert.throws(() => createClassicFilmPlayback({ videos: [new VideoProbe(), null] }), TypeError); checks++;
close(classicFilmTime(4.6, 1), 137 / 30, 'Final decoded frame is 137, not media duration');
close(classicFilmTime(4.6, 10 / 137), 10 / 30, 'Cut preserves exact native frame time');
equal(classicFilmTime(4.6, -1), 0); equal(classicFilmTime(4.6, 2), 137 / 30);
equal(classicFilmTime(NaN, .5), 0); equal(classicFilmTime(4.6, NaN), 0);

// Repeated public updates during one decoder seek do not enqueue seek storms.
// A decoded frame becomes visible even if the current public target has moved.
{
  const h = harness(), [video] = h.videos;
  equal(video.requests.length, 0, 'Construction cannot autoplay');
  h.player.update(intent('toss_heads', .1));
  equal(h.states.at(-1), { status: 'loading', visibleIndex: null });
  video.metadata(); equal(video.seeks.length, 1);
  equal(h.frames.length, 0, 'A seek request is not a decoded media frame');
  close(video.currentTime, classicFilmTime(4.6, .1), 'Initial public target');
  for (let index = 11; index <= 60; index++) h.player.update(intent('toss_heads', index / 100));
  equal(video.seeks.length, 1, 'One outstanding decoder seek, regardless of React updates');
  equal(h.states.at(-1).visibleIndex, null, 'No undecoded frame shown');
  video.decode();
  equal(h.states.at(-1), { status: 'ready', visibleIndex: 0 }, 'First decoded frame is presented before catching up');
  equal(h.frames.at(-1), { time: classicFilmTime(4.6, .1), frame: 13,
    token: 'round-1', src: '/coinflip/desktop/toss_heads.mp4', index: 0 }, 'Handoff callback reports the decoded frame, not the newer requested public target');
  equal(video.seeks.length, 2); close(video.currentTime, classicFilmTime(4.6, .6), 'Decoder then catches up to latest target');
  for (let index = 61; index <= 90; index++) h.player.update(intent('toss_heads', index / 100));
  video.decode(); equal(h.states.at(-1).visibleIndex, 0);
  equal(h.frames.at(-1).frame, 82, 'Continued decoding reports actual native frame 82 before seeking frame 123');
  equal(video.seeks.length, 3); close(video.currentTime, classicFilmTime(4.6, .9), 'Continuous target never starves decoded frames');
  video.decode(); equal(video.seeking, false);
  const decodedCount = h.frames.length;
  for (let index = 0; index < 30; index++) h.player.update(intent('toss_heads', .9));
  equal(h.frames.length, decodedCount, 'Repeated renders of one decoded time do not duplicate handoff callbacks');
  equal(video.requests.length, 0, 'An action is externally scrubbed, never played independently');
  equal(video.muted && video.defaultMuted, true);
  h.player.dispose();
}

// Preserve the old decoded image during source loading, then cut at the same
// public progress rather than starting the close-up from frame zero.
{
  const h = harness(), [wide, closeup] = h.videos;
  const p = 10 / 137;
  h.player.update(intent('toss_heads', p)); wide.metadata(); wide.decode();
  equal(h.states.at(-1).visibleIndex, 0);
  h.player.update(intent('toss_heads_close', p));
  equal(h.states.at(-1), { status: 'loading', visibleIndex: 0 }, 'Wide frame remains until close-up decodes');
  closeup.metadata(); close(closeup.currentTime, 10 / 30, 'Close-up continues the flick at native frame ten');
  equal(h.states.at(-1).visibleIndex, 0, 'Metadata alone cannot replace decoded image');
  closeup.decode(); equal(h.states.at(-1), { status: 'ready', visibleIndex: 1 });
  wide.emit('error'); wide.emit('seeked');
  equal(h.states.at(-1).visibleIndex, 1, 'Events from an inactive buffer cannot hide the selected film');
  h.player.update(intent('toss_heads_close', 1)); closeup.decode();
  close(closeup.currentTime, 137 / 30, 'Skip/complete seeks final accepted-face frame');
  h.player.update(intent('toss_heads_close', .5, { token: 'round-2' }));
  equal(h.states.at(-1).visibleIndex, 1, 'A new round keeps the prior decoded result while loading');
  wide.metadata(); wide.decode(); equal(h.states.at(-1).visibleIndex, 0);
  h.player.update(intent('toss_heads_close', .5, { token: 'round-2', src: '/coinflip/mobile/toss_heads_close.mp4' }));
  equal(h.states.at(-1).visibleIndex, null, 'A framing change cannot display a wrongly scaled desktop buffer');
  h.player.dispose();
}

for (const reduced of [false, true]) {
  const h = harness(), [video] = h.videos;
  h.player.update(intent('toss_tails_close', 1, { visible: false, reduced }));
  video.metadata(); video.decode();
  equal(video.requests.length, 0, 'Hidden action has no play request');
  equal(video.seeks.length, 0, 'Hidden action does not burn decoder work');
  equal(h.states.at(-1).visibleIndex, null);
  h.player.update(intent('toss_tails_close', 1, { visible: true, reduced }));
  close(video.currentTime, 137 / 30, 'Visible skip/reduced intent still selects the actual final film frame');
  video.decode(); equal(h.states.at(-1).visibleIndex, 0);
  equal(video.requests.length, 0, 'Reduced/normal actions cannot independently autoplay');
  h.player.dispose();
}

{
  const h = harness(), [video] = h.videos;
  h.player.update(intent('idle', 0, { reduced: true })); video.metadata(9); video.decode();
  equal(video.requests.length, 0, 'Reduced idle retains a decoded still without autoplay');
  equal(video.paused, true); equal(video.currentTime, 0);
  h.player.dispose();
}

{
  const h = harness(), [video] = h.videos;
  h.player.update(intent('idle', 0)); video.metadata(9); video.decode();
  h.player.update(intent('idle', 0, { visible: false }));
  video.fulfill(0); await flush();
  equal(video.paused, true, 'A play request fulfilled while hidden is immediately stopped');
  equal(h.states.at(-1).status, 'paused'); equal(video.requests.length, 1);
  h.player.dispose();
}

{
  const h = harness(), [video] = h.videos; video.throwPlay = true;
  h.player.update(intent('idle', 0)); video.metadata(9);
  equal(h.states.at(-1), { status: 'poster', visibleIndex: null }, 'Synchronous play failure has a quiet poster fallback');
  for (let index = 0; index < 10; index++) h.player.update(intent('idle', 0));
  equal(video.requests.length, 0); equal(h.settlements(), 0); h.player.dispose();
}

{
  const h = harness(), [video] = h.videos; video.throwSeek = true;
  h.player.update(intent('toss_heads', .5)); video.metadata();
  equal(h.states.at(-1), { status: 'poster', visibleIndex: null }, 'Synchronous decoder seek failure is contained');
  equal(video.requests.length, 0); equal(h.settlements(), 0); h.player.dispose();
}

// A blocked idle shows a poster once, does not hammer play() on every render,
// and recovers only when visibility/reduced-motion policy genuinely changes.
{
  const h = harness(), [video] = h.videos;
  h.player.update(intent('idle', 0)); video.metadata(9); video.decode();
  equal(video.requests.length, 1); equal(video.loop, true);
  video.requests[0].reject(new Error('Autoplay rejected')); await flush();
  equal(h.states.at(-1), { status: 'poster', visibleIndex: null });
  for (let index = 0; index < 20; index++) h.player.update(intent('idle', index / 20));
  equal(video.requests.length, 1, 'A rejected idle is not retried on every public update');
  h.player.update(intent('idle', 0, { reduced: true }));
  equal(video.requests.length, 1); equal(video.paused, true);
  h.player.update(intent('idle', 0)); equal(video.requests.length, 2);
  video.fulfill(1); await flush(); equal(h.states.at(-1).visibleIndex, 0);
  h.player.update(intent('idle', 0, { visible: false })); equal(video.paused, true);
  h.player.dispose();
}

// StrictMode may mount a replacement owner on the very same DOM nodes before
// an old play promise resolves or before the obsolete cleanup runs.
{
  const videos = [new VideoProbe(), new VideoProbe()];
  const first = harness(videos); first.player.update(intent('idle', 0));
  videos[0].metadata(9); videos[0].decode(); equal(videos[0].requests.length, 1);
  const second = harness(videos); second.player.update(intent('idle', 0));
  equal(videos[0].requests.length, 2);
  videos[0].fulfill(1); await flush();
  const pauses = videos[0].pauseCount, states = second.states.length;
  first.player.dispose();
  equal(videos[0].pauseCount, pauses, 'Obsolete cleanup cannot pause the replacement owner');
  videos[0].fulfill(0, false); await flush();
  equal(videos[0].pauseCount, pauses, 'Old fulfilled promise cannot pause current owner');
  equal(second.states.length, states); equal(videos[0].paused, false);
  second.player.dispose();
  equal(videos[0].listeners.size, 0); equal(videos[1].listeners.size, 0);
  equal(videos[0].paused, true);
}

// React clears callback refs before passive-effect cleanup. The caller's
// mutable ref array therefore cannot also be the driver's ownership inventory.
{
  const first = new VideoProbe(), second = new VideoProbe();
  const refs = [first, second], h = harness(refs);
  h.player.update(intent('idle', 0)); first.metadata(9); first.decode();
  equal(first.requests.length, 1);
  refs[0] = null; refs[1] = null;
  assert.doesNotThrow(() => h.player.dispose(), 'Ref detachment before effect cleanup must not dereference null DOM entries'); checks++;
  equal(first.listeners.size, 0); equal(second.listeners.size, 0);
  equal(first.paused, true); equal(second.paused, true);
  const states = h.states.length;
  first.fulfill(0); await flush();
  first.emit('seeked'); first.emit('error'); second.emit('canplay');
  equal(first.paused, true, 'Late promise after ref detachment is safely stopped on the captured node');
  equal(h.states.length, states, 'Detached-ref cleanup has no late component update');
  assert.doesNotThrow(() => h.player.dispose(), 'Detached-ref cleanup is idempotent'); checks++;
}

// Late idle rejection from another generation cannot hide a new accepted
// action. Failed decoding, ended events and disposal never settle a bet.
{
  const h = harness(), [idle, action] = h.videos;
  h.player.update(intent('idle', 0)); idle.metadata(9); idle.decode();
  h.player.update(intent('toss_tails_close', 1)); action.metadata(); action.decode();
  idle.requests[0].reject(new Error('Stale play')); await flush();
  equal(h.states.at(-1), { status: 'ready', visibleIndex: 1 });
  for (let index = 0; index < 3; index++) action.emit('ended');
  action.emit('error');
  equal(h.states.at(-1), { status: 'poster', visibleIndex: null });
  const failedFrameCount = h.frames.length;
  action.emit('seeked'); action.emit('canplay');
  equal(h.states.at(-1), { status: 'poster', visibleIndex: null }, 'A late seek event cannot resurrect a failed source');
  equal(h.frames.length, failedFrameCount, 'A failed decoder cannot authorize a late media handoff');
  equal(h.settlements(), 0, 'Media has no financial completion authority');
  const oldStateCount = h.states.length;
  h.player.dispose(); h.player.dispose();
  idle.emit('playing'); action.emit('seeked'); action.emit('error');
  h.player.update(intent('idle', 0));
  equal(h.states.length, oldStateCount, 'Disposed owner cannot publish state');
  equal(idle.listeners.size, 0); equal(action.listeners.size, 0);
  equal(h.settlements(), 0);
}

// Same-source policy generations must own their pending play() state too.
// A stale callback must not unlock another request while the current play is
// pending, or visibility changes can produce duplicate autoplay requests.
{
  const h = harness(), [video] = h.videos;
  h.player.update(intent('idle', 0)); video.metadata(9); video.decode();
  h.player.update(intent('idle', 0, { visible: false }));
  h.player.update(intent('idle', 0)); equal(video.requests.length, 2);
  video.fulfill(0, false); await flush();
  h.player.update(intent('idle', 0));
  equal(video.requests.length, 2, 'A stale idle fulfillment cannot clear the current generation play-in-flight guard');
  video.requests[1].reject(new Error('Current request rejected')); await flush();
  h.player.dispose();
}

{
  const h = harness(), [video] = h.videos;
  h.player.update(intent('idle', 0)); video.metadata(9); video.decode();
  equal(video.requests.length, 1);
  h.player.dispose(); const stateCount = h.states.length;
  video.fulfill(0); await flush();
  equal(video.paused, true, 'A late play fulfillment after final cleanup cannot leave an ownerless video running');
  equal(h.states.length, stateCount, 'Final cleanup cannot publish late state');
}

{
  const h = harness(), [video] = h.videos;
  h.player.update(intent('idle', 0)); video.metadata(9); video.decode();
  h.player.update(intent('idle', 0, { visible: false }));
  h.player.update(intent('idle', 0)); equal(video.requests.length, 2);
  video.requests[0].reject(new Error('Old hidden generation rejected')); await flush();
  h.player.update(intent('idle', 0));
  equal(video.requests.length, 2, 'A stale idle rejection cannot clear the current generation play-in-flight guard');
  video.requests[1].reject(new Error('Current request rejected')); await flush();
  h.player.dispose();
}

console.log(`Classic film playback: ${checks} checks passed; decoder buffering, canonical frame times, policy, generation ownership, cleanup and no settlement.`);
