const videoOwners = new WeakMap();

/**
 * Presentation-only video lifecycle. It owns no game state, timers, audio or
 * outcome clips. A rejected/failed playback stays on the poster until a fresh
 * pause, motion or visibility intent permits another attempt.
 */
export function createBlackjackDealerVideoPlayback({ video, onState = () => {}, isHidden = () => false }) {
  const owner = {};
  videoOwners.set(video, owner);
  let disposed = false;
  let generation = 0;
  let active = false;
  let intent = { paused: false, reducedMotion: false };
  let policyKey = null;
  let state = 'poster';

  const publish = next => {
    if (disposed || videoOwners.get(video) !== owner || state === next) return;
    state = next;
    onState(next);
  };
  const safelyPause = () => {
    // React's development remount may reuse a DOM video before the old play
    // promise settles. That older controller cannot pause the newer owner.
    const currentOwner = videoOwners.get(video);
    if (currentOwner && currentOwner !== owner) return;
    try { video.pause(); } catch { /* Poster remains available. */ }
  };
  const permitted = () => !disposed && videoOwners.get(video) === owner && active &&
    !intent.paused && !intent.reducedMotion && !isHidden();
  const playing = () => {
    if (!permitted()) { safelyPause(); return; }
    publish('playing');
  };
  const paused = () => {
    if (state === 'blocked' || state === 'error') return;
    publish(active ? 'poster' : 'paused');
  };
  const failed = () => {
    if (disposed) return;
    active = false;
    ++generation;
    publish('error');
    safelyPause();
  };

  video.addEventListener('playing', playing);
  video.addEventListener('pause', paused);
  video.addEventListener('error', failed);

  const update = (next = intent) => {
    if (disposed || videoOwners.get(video) !== owner) return;
    intent = { paused: Boolean(next.paused), reducedMotion: Boolean(next.reducedMotion) };
    const hidden = Boolean(isHidden());
    const key = `${Number(intent.paused)}:${Number(intent.reducedMotion)}:${Number(hidden)}`;
    if (key === policyKey) return;
    policyKey = key;
    const ticket = ++generation;
    active = !intent.paused && !intent.reducedMotion && !hidden;
    if (!active) {
      publish('paused');
      safelyPause();
      return;
    }
    video.muted = true;
    video.defaultMuted = true;
    publish('loading');
    let request;
    try { request = video.play(); }
    catch {
      active = false;
      publish('blocked');
      safelyPause();
      return;
    }
    Promise.resolve(request).then(() => {
      if (!permitted()) { safelyPause(); return; }
      // An older fulfilled request must not pause a newer, valid request.
      if (ticket !== generation) return;
      if (video.readyState >= 2 && !video.paused) publish('playing');
    }, () => {
      if (disposed || ticket !== generation) return;
      active = false;
      publish('blocked');
      safelyPause();
    });
  };

  return {
    update,
    refresh: () => update(intent),
    dispose() {
      if (disposed) return;
      disposed = true;
      active = false;
      ++generation;
      video.removeEventListener('playing', playing);
      video.removeEventListener('pause', paused);
      video.removeEventListener('error', failed);
      safelyPause();
      if (videoOwners.get(video) === owner) videoOwners.delete(video);
    },
  };
}

export const BLACKJACK_DEALER_CLIPS = Object.freeze({
  idle: 10,
  deal_player: 40 / 30,
  deal_dealer: 40 / 30,
  reveal: 45 / 30,
  lose_laugh: 79 / 30,
  player_bust: 79 / 30,
  player_win: 73 / 30,
  big_win: 109 / 30,
  push: 55 / 30,
});

const clipAction = action => ({
  clip: Object.hasOwn(BLACKJACK_DEALER_CLIPS, action?.clip) ? action.clip : 'idle',
  token: String(action?.token ?? 'idle'),
});

/**
 * Two complete scene videos, one media clock. The previous decoded frame stays
 * visible while the next source loads. The caller owns the gesture queue and
 * changes the action token; this player never guesses a game result.
 */
export function createBlackjackDealerClipPlayback({
  videos,
  onState = () => {},
  onReady = () => {},
  onProgress = () => {},
  onEnded = () => {},
  onError = () => {},
  isHidden = () => false,
  requestFrame = callback => globalThis.requestAnimationFrame(callback),
  cancelFrame = id => globalThis.cancelAnimationFrame(id),
  setTimer = (callback, ms) => globalThis.setTimeout(callback, ms),
  clearTimer = id => globalThis.clearTimeout(id),
  readyTimeoutMs = 8000,
}) {
  if (!Array.isArray(videos) || videos.length !== 2 || videos.some(video => !video)) {
    throw new TypeError('A dealer clip player requires two video elements');
  }
  const owner = {};
  videos.forEach(video => videoOwners.set(video, owner));
  let disposed = false;
  let generation = 0;
  let intent = { paused: false, reducedMotion: false, action: clipAction() };
  let policyKey = null;
  let current = null;
  let visibleIndex = null;
  let frameRequest = null;
  let timer = null;
  let state = { state: 'poster', visibleIndex: null, clip: 'idle', token: 'idle' };

  const owned = index => !disposed && videoOwners.get(videos[index]) === owner;
  const permitted = () => current && owned(current.index) && !intent.paused &&
    !intent.reducedMotion && !isHidden() && !current.failed;
  const pause = index => {
    const currentOwner = videoOwners.get(videos[index]);
    if (currentOwner && currentOwner !== owner) return;
    try { videos[index].pause(); } catch { /* Keep the decoded frame/poster. */ }
  };
  const stopClock = () => {
    if (!frameRequest) return;
    const { index, id, native } = frameRequest;
    frameRequest = null;
    if (native) {
      try { videos[index].cancelVideoFrameCallback?.(id); } catch { /* Already delivered. */ }
    } else cancelFrame(id);
  };
  const stopDeadline = () => {
    if (timer !== null) clearTimer(timer);
    timer = null;
  };
  const publish = next => {
    if (disposed || videos.some((_, index) => !owned(index))) return;
    const candidate = {
      state: next,
      visibleIndex: next === 'paused' || next === 'error' || next === 'blocked' ? null : visibleIndex,
      clip: current?.clip ?? intent.action.clip,
      token: current?.token ?? intent.action.token,
    };
    if (Object.keys(candidate).every(key => candidate[key] === state[key])) return;
    state = candidate;
    onState(candidate);
  };
  const valid = (target, ticket) => permitted() && target === current && ticket === generation;
  const fail = (target, ticket, reason, failureState = 'error') => {
    if (!valid(target, ticket) || target.ended) return;
    target.failed = true;
    ++generation;
    stopClock();
    stopDeadline();
    pause(target.index);
    publish(failureState);
    onError(target.token, target.clip, reason);
  };
  const armDeadline = (target, ticket) => {
    stopDeadline();
    timer = setTimer(() => {
      timer = null;
      fail(target, ticket, 'timeout');
    }, readyTimeoutMs);
  };
  const ready = (target, ticket) => {
    if (!valid(target, ticket)) return false;
    visibleIndex = target.index;
    publish('playing');
    if (!target.ready) {
      stopDeadline();
      target.ready = true;
      onReady(target.token, target.clip);
      if (!valid(target, ticket)) return false;
      target.progressSent = true;
      armDeadline(target, ticket);
      onProgress(0, target.token, target.clip);
    }
    return valid(target, ticket);
  };
  const progress = (target, ticket, time) => {
    if (!ready(target, ticket)) return;
    const seconds = Math.max(0, Number(time) || 0);
    // Idle loops naturally wrap. Actions are monotonic even if an old decoded
    // frame is delivered after a seek or pause/resume.
    if (target.clip !== 'idle' && seconds < target.time) return;
    if (seconds === target.time && target.progressSent) return;
    target.time = seconds;
    target.progressSent = true;
    armDeadline(target, ticket);
    onProgress(seconds, target.token, target.clip);
  };
  const queueFrame = (target, ticket) => {
    if (!valid(target, ticket) || target.ended || frameRequest) return;
    const video = videos[target.index];
    const native = typeof video.requestVideoFrameCallback === 'function';
    const callback = (_now, metadata) => {
      // Cancellation alone is not sufficient: a callback may already be queued.
      if (!valid(target, ticket) || target.ended) return;
      frameRequest = null;
      if (video.readyState >= 2 && !video.paused) {
        progress(target, ticket, native ? metadata.mediaTime : video.currentTime);
      }
      queueFrame(target, ticket);
    };
    try {
      const id = native ? video.requestVideoFrameCallback(callback) : requestFrame(callback);
      frameRequest = { index: target.index, id, native };
    } catch { fail(target, ticket, 'media'); }
  };
  const ended = index => {
    const target = current, ticket = generation;
    if (!target || target.index !== index || target.clip === 'idle' || !valid(target, ticket) || target.ended) return;
    if (!ready(target, ticket)) return;
    const duration = Number.isFinite(videos[index].duration) && videos[index].duration > 0
      ? videos[index].duration : BLACKJACK_DEALER_CLIPS[target.clip];
    progress(target, ticket, duration);
    if (!valid(target, ticket)) return;
    target.ended = true;
    stopClock();
    stopDeadline();
    pause(index);
    publish('ended');
    onEnded(target.token, target.clip);
  };
  const listeners = videos.map((video, index) => {
    const playing = () => {
      if (!current || current.index !== index || !permitted()) { pause(index); return; }
      queueFrame(current, generation);
    };
    const error = () => {
      if (current?.index === index) fail(current, generation, 'media');
    };
    const finish = () => ended(index);
    video.addEventListener('playing', playing);
    video.addEventListener('error', error);
    video.addEventListener('ended', finish);
    return { playing, error, finish };
  });

  const update = (next = intent) => {
    if (disposed || videos.some((_, index) => !owned(index))) return;
    intent = {
      paused: Boolean(next.paused),
      reducedMotion: Boolean(next.reducedMotion),
      action: clipAction(next.action),
    };
    const key = `${Number(intent.paused)}:${Number(intent.reducedMotion)}:${Number(Boolean(isHidden()))}`;
    const changedAction = !current || current.clip !== intent.action.clip || current.token !== intent.action.token;
    if (key === policyKey && !changedAction) return;
    policyKey = key;
    const ticket = ++generation;
    stopClock();
    stopDeadline();
    videos.forEach((_, index) => pause(index));
    if (intent.paused || intent.reducedMotion || isHidden()) {
      publish('paused');
      return;
    }
    if (changedAction) {
      const index = current ? 1 - current.index : 0;
      current = { ...intent.action, index, ready: false, failed: false, ended: false, time: 0, progressSent: false };
      const video = videos[index];
      const source = `/blackjack-dealer-v35/${current.clip}.mp4`;
      video.muted = true;
      video.defaultMuted = true;
      video.loop = current.clip === 'idle';
      video.playbackRate = 1;
      video.preload = 'auto';
      try {
        if (video.getAttribute('src') !== source) {
          video.setAttribute('src', source);
          video.load();
        }
      } catch { fail(current, ticket, 'media'); return; }
      try { video.currentTime = 0; } catch { /* A new source already starts at zero. */ }
    } else if (current.ended) {
      publish('ended');
      return;
    } else {
      // A fresh visible or explicit pause/resume intent can recover playback.
      current.failed = false;
    }
    const target = current, video = videos[target.index];
    if (!valid(target, ticket)) return;
    publish('loading');
    armDeadline(target, ticket);
    let request;
    try { request = video.play(); }
    catch { fail(target, ticket, 'autoplay', 'blocked'); return; }
    Promise.resolve(request).then(() => {
      if (!valid(target, ticket)) {
        // Only a truly inactive/old owner may pause; an earlier fulfilled play
        // cannot stop a newer action that is now using the same DOM element.
        if (!permitted() || current?.index !== target.index) pause(target.index);
        return;
      }
      queueFrame(target, ticket);
    }, () => fail(target, ticket, 'autoplay', 'blocked'));
  };

  return {
    update,
    refresh: () => update(intent),
    dispose() {
      if (disposed) return;
      disposed = true;
      ++generation;
      stopClock();
      stopDeadline();
      videos.forEach((video, index) => {
        const { playing, error, finish } = listeners[index];
        video.removeEventListener('playing', playing);
        video.removeEventListener('error', error);
        video.removeEventListener('ended', finish);
        pause(index);
        if (videoOwners.get(video) === owner) videoOwners.delete(video);
      });
    },
  };
}
