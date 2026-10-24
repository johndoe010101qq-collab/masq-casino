// One animation clock; visibility and settlement do not depend on React renders.
export function createRoundPlayback({ duration, requestFrame, cancelFrame, isHidden, onProgress, onComplete, onError = () => {} }) {
  let elapsed = 0, previous = null, frame = null, closed = false, paused = false;
  const finish = (show = true) => {
    if (closed) return false;
    closed = true;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    onComplete(show);
    return true;
  };
  const tick = now => {
    frame = null;
    if (closed || paused || isHidden()) { previous = null; return; }
    // A suspended foreground thread must not skip the remaining bonus spins.
    if (previous !== null) elapsed += Math.min(100, Math.max(0, now - previous));
    previous = now;
    const progress = Math.min(1, elapsed / duration);
    try { onProgress(progress); }
    catch (error) { try { onError(error); } finally { finish(false); } return; }
    if (closed || paused) return;
    if (progress === 1) finish();
    else frame = requestFrame(tick);
  };
  const visibilityChanged = () => {
    previous = null;
    if (frame !== null) cancelFrame(frame);
    frame = null;
    if (!closed && !paused && !isHidden()) frame = requestFrame(tick);
  };
  return { start: visibilityChanged, visibilityChanged, finish,
    pause:()=>{if(closed)return false;paused=true;previous=null;if(frame!==null)cancelFrame(frame);frame=null;return true;},
    resume:progress=>{if(closed||!paused)return false;if(progress!==undefined){if(!Number.isFinite(progress)||progress<elapsed/duration||progress>1)throw new RangeError('Invalid presentation position.');elapsed=progress*duration;}paused=false;visibilityChanged();return true;}
  };
}
