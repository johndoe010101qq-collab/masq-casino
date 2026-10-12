import assert from 'node:assert/strict';
import { createBlackjackDealerVideoPlayback } from '../src/blackjack-dealer-video-playback.js';

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

console.log(`Blackjack dealer video lifecycle: ${checks} checks passed`);
