import React from 'react';
import { getBlackjackDealerPose } from './blackjack-dealer-presentation.js';
import './AnonymousDealer.css';

// Packed six-frame art already used by MASQ. Each layer occupies one complete
// 362×724 cell, then clips a specific limb INSIDE that cell. The head alone uses
// the blink frame; arms use the open-hand frame. Neighbouring sprites cannot
// enter any viewport, even while these independently articulated layers move.
export default function AnonymousDealer({ display, reducedMotion = false, paused = false, originRef }) {
  const pose = getBlackjackDealerPose(display, { reducedMotion });
  return <div className="bj-dealer-stage" aria-hidden="true" data-phase={pose.phase}
    data-reduced-motion={reducedMotion} data-paused={paused} data-reacting={pose.reacting}>
    <div className="bj-dealer-nameplate"><span>ANONYMOUS</span><small>Крупье</small></div>
    <div className="bj-dealer-window">
      <div className="bj-dealer-rig" style={{ transform:`translateY(${pose.bodyLift}%) rotate(${pose.bodyTurn}deg)` }}>
        <span className="bj-dealer-art bj-dealer-torso" />
        <span className="bj-dealer-art bj-dealer-arm bj-dealer-arm-left"
          style={{ transform:`translate(${pose.leftArmX}%,${pose.leftArmY}%) rotate(${pose.leftArmTurn}deg)` }} />
        <span className="bj-dealer-art bj-dealer-arm bj-dealer-arm-right"
          style={{ transform:`translate(${pose.rightArmX}%,${pose.rightArmY}%) rotate(${pose.rightArmTurn}deg)` }} />
        <span className="bj-dealer-head-joint" style={{ transform:`rotate(${pose.headTurn}deg)` }}>
          <span className="bj-dealer-art bj-dealer-head" />
        </span>
      </div>
    </div>
    <div className="bj-dealer-table-edge" />
    <div ref={originRef} className="bj-dealer-shoe"><span /><span /><span /></div>
  </div>;
}
