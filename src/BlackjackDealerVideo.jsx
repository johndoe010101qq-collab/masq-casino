import React, { useEffect, useRef, useState } from 'react';
import { createBlackjackDealerVideoPlayback } from './blackjack-dealer-video-playback.js';

const poster = '/blackjack-dealer-poster-v34.webp';
const cover = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };

// The approved, silent idle is the complete scene. Genuine cards are rendered
// separately by the table; there are no inferred outcome or gesture videos.
export default function BlackjackDealerVideo({ paused = false, reducedMotion = false }) {
  const video = useRef(null);
  const playback = useRef(null);
  const policy = useRef({ paused, reducedMotion });
  policy.current = { paused, reducedMotion };
  const [state, setState] = useState('poster');

  useEffect(() => {
    const controller = createBlackjackDealerVideoPlayback({
      video: video.current,
      onState: setState,
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

  useEffect(() => { playback.current?.update({ paused, reducedMotion }); }, [paused, reducedMotion]);

  const visible = state === 'playing' && !paused && !reducedMotion;
  return <div className="bj-dealer-video-scene" aria-hidden="true" data-state={state}
    data-playing={visible}
    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', overflow: 'hidden', pointerEvents: 'none' }}>
    <img className="bj-dealer-video-poster" src={poster} alt="" width="1920" height="1080"
      draggable="false" decoding="async" style={cover} />
    <video ref={video} className="bj-dealer-video" src="/blackjack-dealer-idle-v34.mp4"
      poster={poster} muted loop playsInline preload="metadata" controls={false} tabIndex={-1}
      style={{ ...cover, opacity: visible ? 1 : 0 }} />
  </div>;
}
