import React, { useState } from 'react';
import { getLexofMascotPresentation } from './lexof-mascot-presentation.js';
import './LexofMascot.css';

// Optional decorative avatar for the LeXof bonus/purchase/shop presentation.
// It crops the unchanged first raster cell; it adds no generated face or text.
export function LexofPortrait({ className = '' }) {
  return <span className={'lexof-portrait ' + className} aria-hidden="true">
    <span className="lexof-portrait-sprite"/>
  </span>;
}

// The atlas has six 1:2 portrait cells in a single horizontal row. Frame 1 is
// identical to frame 0 except for the closed eyes used by the idle blink.
export default function LexofMascot({ game, visual, reducedMotion = false }) {
  const [finishedVisual, setFinishedVisual] = useState(null);
  const presentation = getLexofMascotPresentation(visual, game, finishedVisual);
  if (!presentation.visible) return null;

  const {pose,frame,transient} = presentation;
  return <div className="lexof-mascot" aria-hidden="true"
    data-pose={pose} data-transient={transient} data-reduced-motion={reducedMotion}>
    <div className="lexof-mascot-viewport">
      <div key={pose + ':' + presentation.reactionKey} className="lexof-mascot-body">
        <span className="lexof-mascot-sprite" style={{
          '--lexof-frame': `${frame * 20}%`, backgroundPosition: `${frame * 20}% 0%`
        }} onAnimationEnd={event => {
          // CSS pauses with the cabinet, so no independent timeout can expire
          // a reaction while the tab or the accepted round is hidden.
          if (transient && event.target === event.currentTarget
            && event.animationName === 'lexof-mascot-outcome') setFinishedVisual(visual);
        }}/>
      </div>
    </div>
  </div>;
}
