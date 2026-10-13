import assert from 'node:assert/strict';
import { BLACKJACK_DEALER_CLIPS, createBlackjackDealerClipPlayback, createBlackjackDealerVideoPlayback } from '../src/blackjack-dealer-video-playback.js';

let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const settle = async () => { await Promise.resolve(); await Promise.resolve(); };

class VideoProbe {
  listeners = new Map();
  requests = [];
  pauseCount = 0;
  readyState = 0;
  paused = true;
  muted = false;
  defaultMuted = false;
  addEventListener(type, fn) { this.listeners.set(type, fn); }
  removeEventListener(type, fn) { if (this.listeners.get(type) === fn) this.listeners.delete(type); }
  emit(type) { this.listeners.get(type)?.(); }
  play() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    this.requests.push({ resolve, reject });
    return promise;
  }
  pause() { this.pauseCount++; this.paused = true; this.emit('pause'); }
  fulfill(index, { playingEvent = true } = {}) {
    this.readyState = 2; this.paused = false;
    this.requests[index].resolve();
    if (playingEvent) this.emit('playing');
  }
}

const video = new VideoProbe();
const states = [];
let hidden = false;
const controller = createBlackjackDealerVideoPlayback({ video, onState: state => states.push(state), isHidden: () => hidden });
equal(video.requests.length, 0, 'Constructing lifecycle cannot start playback');
controller.update({ paused: false, reducedMotion: false });
equal(video.requests.length, 1, 'Visible idle requests one playback');
equal(video.muted && video.defaultMuted, true, 'Source video cannot emit audio');
equal(states.at(-1), 'loading', 'Poster remains during initial loading');
controller.update({ paused: false, reducedMotion: false });
equal(video.requests.length, 1, 'Repeated render intent does not duplicate play');
video.fulfill(0); await settle();
equal(states.at(-1), 'playing', 'Video becomes visible after actual playback');
controller.update({ paused: true, reducedMotion: false });
equal(video.paused, true, 'Manual pause stops video');
equal(states.at(-1), 'paused', 'Manual pause restores poster');
controller.update({ paused: false, reducedMotion: true });
equal(video.requests.length, 1, 'Reduced motion retains poster without a play request');
controller.update({ paused: false, reducedMotion: false });
equal(video.requests.length, 2, 'Resuming motion permits a fresh request');
hidden = true; controller.refresh();
equal(states.at(-1), 'paused', 'Hidden page restores poster');
video.fulfill(1, { playingEvent: false }); await settle();
equal(video.paused, true, 'A pending play fulfilled after hiding is paused again');
equal(states.at(-1), 'paused', 'Hidden late fulfillment cannot replace poster');
hidden = false; controller.refresh();
equal(video.requests.length, 3, 'Returning to the page requests playback again');
controller.update({ paused: true, reducedMotion: false });
controller.update({ paused: false, reducedMotion: false });
equal(video.requests.length, 4, 'New active intent owns a new play request');
const pausesBeforeStale = video.pauseCount;
video.fulfill(2, { playingEvent: false }); await settle();
equal(video.pauseCount, pausesBeforeStale, 'Older fulfilled request cannot pause a newer active request');
equal(states.at(-1), 'loading', 'Old fulfillment cannot claim readiness for a newer request');
video.requests[2].reject(new Error('Already fulfilled'));
video.requests[3].reject(new Error('Autoplay rejected')); await settle();
equal(states.at(-1), 'blocked', 'Autoplay rejection displays poster without throwing');
controller.refresh(); controller.update({ paused: false, reducedMotion: false });
equal(video.requests.length, 4, 'Rejected autoplay does not retry on every render');
controller.update({ paused: true, reducedMotion: false });
controller.update({ paused: false, reducedMotion: false });
video.fulfill(4); await settle();
equal(states.at(-1), 'playing', 'Fresh user intent can recover from autoplay rejection');
video.emit('error');
equal(video.paused, true, 'Media failure stops playback');
equal(states.at(-1), 'error', 'Media failure restores poster');
controller.refresh(); equal(video.requests.length, 5, 'Failed media does not create an automatic retry loop');
controller.update({ paused: true, reducedMotion: false });
controller.update({ paused: false, reducedMotion: false });
const statesBeforeDispose = states.length;
controller.dispose(); controller.dispose();
equal(video.listeners.size, 0, 'Disposal removes every media listener');
equal(video.paused, true, 'Disposal pauses video');
video.fulfill(5); await settle();
equal(video.paused, true, 'A pending fulfillment after unmount is paused');
equal(states.length, statesBeforeDispose, 'Cleanup never updates an unmounted component');
controller.update({ paused: false, reducedMotion: false }); controller.refresh();
equal(video.requests.length, 6, 'Disposed controller cannot restart playback');

const hiddenVideo = new VideoProbe();
const hiddenStates = [];
const hiddenController = createBlackjackDealerVideoPlayback({ video: hiddenVideo, onState: state => hiddenStates.push(state), isHidden: () => true });
hiddenController.update({ paused: false, reducedMotion: false });
equal(hiddenVideo.requests.length, 0, 'Mounting in a hidden tab never requests playback');
equal(hiddenStates.at(-1), 'paused', 'Hidden mount keeps poster');
hiddenController.dispose();

const throwingVideo = new VideoProbe();
throwingVideo.play = () => { throw new Error('Unsupported source'); };
const throwStates = [];
const throwingController = createBlackjackDealerVideoPlayback({ video: throwingVideo, onState: state => throwStates.push(state) });
throwingController.update({ paused: false, reducedMotion: false });
equal(throwStates.at(-1), 'blocked', 'Synchronous play errors also retain poster');
throwingController.dispose();

const staleVideo = new VideoProbe();
const staleStates = [];
const staleController = createBlackjackDealerVideoPlayback({ video: staleVideo, onState: state => staleStates.push(state) });
staleController.update({ paused: false, reducedMotion: false });
staleController.update({ paused: true, reducedMotion: false });
staleController.update({ paused: false, reducedMotion: false });
staleVideo.fulfill(1); await settle();
staleVideo.requests[0].reject(new Error('Old interrupted play')); await settle();
equal(staleStates.at(-1), 'playing', 'An old rejected request cannot hide newer successful playback');
equal(staleVideo.paused, false, 'An old rejection cannot stop newer playback');
staleController.dispose();

const remountVideo = new VideoProbe();
const oldStates = [], newStates = [];
const oldController = createBlackjackDealerVideoPlayback({ video: remountVideo, onState: state => oldStates.push(state) });
oldController.update({ paused: false, reducedMotion: false });
oldController.dispose();
const newController = createBlackjackDealerVideoPlayback({ video: remountVideo, onState: state => newStates.push(state) });
newController.update({ paused: false, reducedMotion: false });
remountVideo.fulfill(1); await settle();
const remountPauseCount = remountVideo.pauseCount, oldStateCount = oldStates.length;
remountVideo.fulfill(0, { playingEvent: false }); await settle();
equal(remountVideo.pauseCount, remountPauseCount, 'Development remount ignores the previous owner\'s fulfilled promise');
equal(remountVideo.paused, false, 'Development remount keeps the new owner playing');
equal(newStates.at(-1), 'playing', 'Previous owner cannot hide the new owner\'s video');
equal(oldStates.length, oldStateCount, 'Disposed owner never publishes after a remount');
newController.dispose();

class ClipVideoProbe extends VideoProbe {
  attributes = new Map();
  frames = new Map();
  frameArchive = [];
  frameSequence = 0;
  currentTime = 0;
  duration = NaN;
  loadCount = 0;
  playbackRate = 3;
  getAttribute(name) { return this.attributes.get(name); }
  setAttribute(name, value) { this.attributes.set(name, value); }
  load() { this.loadCount++; this.readyState = 0; this.currentTime = 0; }
  requestVideoFrameCallback(callback) {
    const id = ++this.frameSequence;
    this.frames.set(id, callback);
    this.frameArchive.push(callback);
    return id;
  }
  cancelVideoFrameCallback(id) { this.frames.delete(id); }
  decode(time) {
    this.currentTime = time;
    const [id, callback] = this.frames.entries().next().value ?? [];
    if (!callback) throw new Error('No pending decoded-frame callback');
    this.frames.delete(id);
    callback(0, { mediaTime: time });
  }
}

const makeClipHarness = ({ native = true } = {}) => {
  const videos = [new ClipVideoProbe(), new ClipVideoProbe()];
  const states = [], ready = [], times = [], ends = [], errors = [];
  const timers = new Map(), rafs = new Map();
  let hidden = false, timerId = 0, rafId = 0;
  if (!native) videos.forEach(item => { item.requestVideoFrameCallback = undefined; });
  const controller = createBlackjackDealerClipPlayback({
    videos,
    onState: value => states.push(value),
    onReady: (...args) => ready.push(args),
    onProgress: (...args) => times.push(args),
    onEnded: (...args) => ends.push(args),
    onError: (...args) => errors.push(args),
    isHidden: () => hidden,
    setTimer: callback => { const id = ++timerId; timers.set(id, callback); return id; },
    clearTimer: id => timers.delete(id),
    requestFrame: callback => { const id = ++rafId; rafs.set(id, callback); return id; },
    cancelFrame: id => rafs.delete(id),
  });
  return {
    videos, states, ready, times, ends, errors, timers, rafs, controller,
    setHidden(value) { hidden = value; controller.refresh(); },
    expire() {
      const [id, callback] = timers.entries().next().value ?? [];
      if (!callback) throw new Error('No playback deadline');
      timers.delete(id); callback();
    },
    raf() {
      const [id, callback] = rafs.entries().next().value ?? [];
      if (!callback) throw new Error('No animation callback');
      rafs.delete(id); callback();
    },
  };
};
const clipIntent = (clip, token, policy = {}) => ({ action: { clip, token }, paused: false, reducedMotion: false, ...policy });
const pack = makeClipHarness();
pack.controller.update(clipIntent('idle', 'waiting'));
equal(pack.videos[0].getAttribute('src'), '/blackjack-dealer-v35/idle.mp4', 'Only a packaged clip path can be loaded');
equal(pack.videos[0].loop, true, 'Only the waiting clip loops');
equal(pack.videos[0].playbackRate, 1, 'Dealer gesture playback is independent of slot speed');
equal(pack.states.at(-1).visibleIndex, null, 'Initial loading retains the static neutral poster');
pack.videos[0].fulfill(0); await settle();
equal(pack.ready.length, 0, 'A fulfilled play promise does not claim a decoded frame');
pack.videos[0].decode(0);
equal(pack.ready, [['waiting', 'idle']], 'The first decoded frame announces the requested token');
equal(pack.states.at(-1).visibleIndex, 0, 'Only the decoded buffer becomes visible');
equal(pack.times.at(-1), [0, 'waiting', 'idle'], 'Presentation receives the media clock, not wall time');
const oldFrame = pack.videos[0].frameArchive.at(-1);
pack.controller.update(clipIntent('deal_player', 'opening-player-0'));
equal(pack.videos[1].getAttribute('src'), '/blackjack-dealer-v35/deal_player.mp4', 'The next gesture loads in the other buffer');
equal(pack.states.at(-1).visibleIndex, 0, 'Loading a gesture retains the previous complete scene');
equal(pack.videos[1].loop, false, 'Dealing is a single action');
equal(pack.videos[0].paused, true, 'The retained previous frame does not drift while loading');
const beforeOldFrame = pack.times.length;
oldFrame(0, { mediaTime: 8 });
equal(pack.times.length, beforeOldFrame, 'A cancelled decoded frame cannot move the new gesture clock');
pack.videos[1].fulfill(0); await settle();
pack.videos[1].decode(0.033);
equal(pack.states.at(-1).visibleIndex, 1, 'A decoded gesture atomically replaces the previous scene');
equal(pack.times.at(-1), [0.033, 'opening-player-0', 'deal_player'], 'Decoded time is tagged with its action token');
pack.videos[1].decode(0.7);
equal(pack.times.at(-1)[0], 0.7, 'Hand release frame retains its exact authored media time');
const beforeBackwardFrame = pack.times.length;
pack.videos[1].decode(0.6);
equal(pack.times.length, beforeBackwardFrame, 'A backwards decoded action frame cannot rewind the public queue');
pack.videos[1].duration = 40 / 30;
pack.videos[1].emit('ended');
equal(pack.times.at(-1), [40 / 30, 'opening-player-0', 'deal_player'], 'Ending flushes the exact media duration into presentation');
equal(pack.ends, [['opening-player-0', 'deal_player']], 'Gesture completion is emitted once');
equal(pack.states.at(-1).state, 'ended', 'The final neutral frame stays visible until the caller selects the next action');
const requestsAtEnd = pack.videos.map(item => item.requests.length);
pack.videos[1].emit('ended');
pack.controller.update(clipIntent('deal_player', 'opening-player-0'));
equal(pack.ends.length, 1, 'Repeated ended events cannot duplicate a gesture completion');
equal(pack.videos.map(item => item.requests.length), requestsAtEnd, 'Rendering the completed token does not replay the gesture');
pack.controller.update(clipIntent('deal_player', 'opening-player-1'));
equal(pack.videos[0].getAttribute('src'), '/blackjack-dealer-v35/deal_player.mp4', 'A new token restarts a repeated same-clip deal');
equal(pack.videos[0].currentTime, 0, 'The next dealt card starts at the gesture origin');
pack.videos[0].fulfill(1); await settle();
pack.videos[0].decode(0.2);
pack.setHidden(true);
equal(pack.states.at(-1).state, 'paused', 'Tab visibility suspends every action clip');
equal(pack.timers.size, 0, 'A hidden page cannot trigger a stalled-media fallback');
equal(pack.videos.every(item => item.paused), true, 'Both scene buffers pause when hidden');
pack.setHidden(false);
pack.videos[0].fulfill(2); await settle();
pack.videos[0].decode(0.25);
equal(pack.times.at(-1), [0.25, 'opening-player-1', 'deal_player'], 'Returning to the page resumes rather than replaying the gesture');
equal(pack.ready.filter(([token]) => token === 'opening-player-1').length, 1, 'Resuming does not duplicate action readiness');
pack.expire();
equal(pack.errors.at(-1), ['opening-player-1', 'deal_player', 'timeout'], 'A mid-gesture decode stall releases the caller to its fallback clock');
equal(pack.states.at(-1).visibleIndex, null, 'A stalled gesture restores the neutral poster');
const attemptsAfterTimeout = pack.videos[0].requests.length;
pack.controller.refresh();
equal(pack.videos[0].requests.length, attemptsAfterTimeout, 'A timeout cannot cause a retry loop on render');
pack.controller.update(clipIntent('reveal', 'reveal-hole'));
pack.videos[1].requests.at(-1).reject(new Error('Autoplay blocked')); await settle();
equal(pack.errors.at(-1), ['reveal-hole', 'reveal', 'autoplay'], 'Autoplay rejection reaches the presentation fallback');
equal(pack.states.at(-1).state, 'blocked', 'Autoplay rejection retains the poster');
pack.controller.update(clipIntent('push', 'round-push', { reducedMotion: true }));
const attemptsWithoutMotion = pack.videos.map(item => item.requests.length);
equal(pack.timers.size, 0, 'Reduced motion has no media deadline');
pack.controller.refresh();
equal(pack.videos.map(item => item.requests.length), attemptsWithoutMotion, 'Reduced motion does not start a hidden action');
pack.controller.update(clipIntent('push', 'round-push'));
pack.videos[0].fulfill(3); await settle();
pack.videos[0].decode(0);
pack.videos[0].emit('error');
equal(pack.errors.at(-1), ['round-push', 'push', 'media'], 'A corrupt source reaches the presentation fallback');
pack.controller.update(clipIntent('https://untrusted.example/video.mp4', 'invalid'));
equal(pack.videos[1].getAttribute('src'), '/blackjack-dealer-v35/idle.mp4', 'Invalid clip names cannot load arbitrary URLs');
pack.controller.dispose();
equal(pack.timers.size, 0, 'Unmount clears the playback watchdog');
equal(pack.videos.every(item => item.frames.size === 0 && item.listeners.size === 0), true, 'Unmount cancels every frame callback and media listener');
const errorsAfterUnmount = pack.errors.length;
pack.videos[1].requests.at(-1).reject(new Error('Unmount interrupted play')); await settle();
equal(pack.errors.length, errorsAfterUnmount, 'A late rejection cannot notify an unmounted table');

const fallbackPack = makeClipHarness({ native: false });
fallbackPack.controller.update(clipIntent('big_win', 'natural-blackjack'));
fallbackPack.videos[0].fulfill(0); await settle();
fallbackPack.videos[0].currentTime = 0.7;
fallbackPack.raf();
equal(fallbackPack.times.at(-1), [0.7, 'natural-blackjack', 'big_win'], 'Browsers without decoded-frame callbacks use native currentTime in RAF');
fallbackPack.controller.dispose();
equal(fallbackPack.rafs.size, 0, 'Fallback animation callbacks are cancelled on unmount');

const noFrames = makeClipHarness();
noFrames.controller.update(clipIntent('player_win', 'no-first-frame'));
noFrames.expire();
equal(noFrames.errors, [['no-first-frame', 'player_win', 'timeout']], 'No decoded first frame has a bounded fallback deadline');
noFrames.controller.dispose();

const reusedPack = makeClipHarness();
reusedPack.controller.update(clipIntent('idle', 'old-owner'));
reusedPack.controller.dispose();
const newOwnerStates = [];
const replacement = createBlackjackDealerClipPlayback({
  videos: reusedPack.videos,
  onState: next => newOwnerStates.push(next),
  setTimer: () => 1, clearTimer: () => {},
});
replacement.update(clipIntent('lose_laugh', 'new-owner'));
reusedPack.videos[0].fulfill(1); await settle();
reusedPack.videos[0].decode(0.1);
const pausesAfterRemount = reusedPack.videos[0].pauseCount;
reusedPack.videos[0].fulfill(0, { playingEvent: false }); await settle();
equal(reusedPack.videos[0].pauseCount, pausesAfterRemount, 'The previous owner cannot pause a reused buffer on late fulfillment');
equal(newOwnerStates.at(-1).clip, 'lose_laugh', 'Development remount retains the new action owner');
replacement.dispose();
equal(Object.keys(BLACKJACK_DEALER_CLIPS).length, 9, 'The complete supplied pack has nine available clips');

console.log(`Blackjack dealer video lifecycle: ${checks} checks passed`);
