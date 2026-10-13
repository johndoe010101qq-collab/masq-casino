import React, { useEffect, useRef, useState } from 'react';
import { createBlackjackDealerClipPlayback } from './blackjack-dealer-video-playback.js';

const poster = '/blackjack-dealer-poster-v34.webp';
const cover = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

// Every clip is the same complete scene. Cards stay outside the video and use
// its decoded frame time, rather than a competing animation clock.
export default function BlackjackDealerVideo({
  action = { clip: 'idle', token: 'idle' },
  paused = false,
  reducedMotion = false,
  onReady,
  onProgress,
  onEnded,
  onError,
}) {
  const firstVideo = useRef(null);
  const secondVideo = useRef(null);
  const playback = useRef(null);
  const policy = useRef({ paused, reducedMotion, action });
  const callbacks = useRef({ onReady, onProgress, onEnded, onError });
  policy.current = { paused, reducedMotion, action };
  callbacks.current = { onReady, onProgress, onEnded, onError };
  const [display, setDisplay] = useState({ state: 'poster', visibleIndex: null, clip: 'idle', token: 'idle' });

  useEffect(() => {
    const controller = createBlackjackDealerClipPlayback({
      videos: [firstVideo.current, secondVideo.current],
      onState: setDisplay,
      onReady: (...args) => callbacks.current.onReady?.(...args),
      onProgress: (...args) => callbacks.current.onProgress?.(...args),
      onEnded: (...args) => callbacks.current.onEnded?.(...args),
      onError: (...args) => callbacks.current.onError?.(...args),
      isHidden: () => document.hidden,
    });
    playback.current = controller;
    const visibility = () => controller.refresh();
    document.addEventListener('visibilitychange', visibility);
    controller.update(policy.current);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      controller.dispose();
      if (playback.current === controller) playback.current = null;
    };
  }, []);

  useEffect(() => {
    playback.current?.update({ paused, reducedMotion, action });
  }, [paused, reducedMotion, action.clip, action.token]);

  const visible = display.visibleIndex !== null && !paused && !reducedMotion;
  return <div className="bj-dealer-video-scene" aria-hidden="true" data-state={display.state}
    data-playing={visible} data-clip={display.clip} data-token={display.token}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
    <img className="bj-dealer-video-poster" src={poster} alt="" width="1920" height="1080"
      draggable="false" decoding="async" style={cover} />
    {[firstVideo, secondVideo].map((video, index) => <video key={index} ref={video}
      className="bj-dealer-video" data-buffer={index} poster={poster}
      muted playsInline preload="metadata" controls={false} tabIndex={-1}
      style={{ ...cover, opacity: visible && display.visibleIndex === index ? 1 : 0 }} />)}
  </div>;
}
