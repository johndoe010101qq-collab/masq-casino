import React, { useEffect, useRef, useState } from 'react';
import { getBlackjackDealerPose } from './blackjack-dealer-presentation.js';
import './AnonymousDealer.css';

// Four isolated raster cells, with joints in layout space. No neighbouring
// pose can enter a moving limb. Outcomes come only from the public projection.
export default function AnonymousDealer({ display, reducedMotion = false, paused = false, originRef, audio }) {
  const [elapsed, setElapsed] = useState(0);
  const clock = useRef(0), chuckled = useRef(false);
  const settled = display?.status === 'resolved' && display?.view?.revealed === true;
  const publicResult = settled ? display.view.result : null;
  const pose = getBlackjackDealerPose(display, { reducedMotion, reactionElapsedMs: elapsed });
  const duration = pose.reactionDurationMs;

  useEffect(() => {
    // Reduced-motion transitions can commit resolved → resolved in one batch.
    // The next public result is a new hand even when its outcome is identical.
    clock.current = 0; chuckled.current = false; setElapsed(0);
  }, [settled, publicResult]);

  useEffect(() => {
    if (!settled) return;
    if (paused || clock.current >= duration || duration <= 0) return;
    let frame, previous = null;
    const tick = now => {
      if (document.hidden) { previous = null; frame = requestAnimationFrame(tick); return; }
      if (previous !== null) clock.current = Math.min(duration, clock.current + Math.max(0, now - previous));
      previous = now; setElapsed(clock.current);
      if (clock.current < duration) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [settled, publicResult, paused, duration]);

  useEffect(() => {
    if (!settled || paused || document.hidden || pose.gesture !== 'chuckle' || chuckled.current) return;
    chuckled.current = true;
    try { audio?.play('dealerChuckle'); } catch { /* Optional decoration never blocks a hand. */ }
  }, [settled, publicResult, paused, pose.gesture, audio]);

  return <div className="bj-dealer-stage" aria-hidden="true" data-phase={pose.phase}
    data-reduced-motion={reducedMotion} data-paused={paused} data-reacting={pose.reacting}
    data-gesture={pose.gesture ?? ''}>
    <div className="bj-dealer-nameplate"><span>ANONYMOUS</span><small>Крупье</small></div>
    <div className="bj-dealer-window">
      <div className="bj-dealer-rig" style={{ transform:`translateY(${pose.bodyLift}%) rotate(${pose.bodyTurn}deg)` }}>
        <span className="bj-dealer-arm-joint bj-dealer-arm-left"
          style={{ transform:`translate(${pose.leftArmX}%,${pose.leftArmY}%) rotate(${pose.leftArmTurn}deg)` }}>
          <span className="bj-dealer-art bj-dealer-arm-art-left" />
        </span>
        <span className="bj-dealer-arm-joint bj-dealer-arm-right"
          style={{ transform:`translate(${pose.rightArmX}%,${pose.rightArmY}%) rotate(${pose.rightArmTurn}deg)` }}>
          <span className="bj-dealer-art bj-dealer-arm-art-right" />
        </span>
        <span className="bj-dealer-art bj-dealer-torso" />
        <span className="bj-dealer-head-joint" style={{ transform:`rotate(${pose.headTurn}deg)` }}>
          <span className="bj-dealer-art bj-dealer-head" />
        </span>
      </div>
    </div>
    {pose.quip && !paused && <div className="bj-dealer-quip" data-outcome={pose.phase}>{pose.quip}</div>}
    <div className="bj-dealer-table-edge" />
    <div ref={originRef} className="bj-dealer-shoe"><span /><span /><span /></div>
  </div>;
}
