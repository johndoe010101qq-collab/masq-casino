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
