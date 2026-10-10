import React, {useState} from 'react';
import {getBonanzaMascotPresentation} from './bonanza-mascot-presentation.js';

// One fixed 4x2 portrait atlas: idle, blink, watch, bonus, four dance poses.
// CSS runs the actual arm/leg frames, with no timers or access to the engine.
export default function BonanzaMascot({visual,reducedMotion=false}) {
  const [finishedVisual,setFinishedVisual]=useState(null);
  const view=getBonanzaMascotPresentation(visual,finishedVisual);
  return <div className="bonanza-mascot" aria-hidden="true"
    data-pose={view.pose} data-transient={view.transient} data-reduced-motion={reducedMotion}>
    <div key={view.reactionKey} className="bonanza-mascot-body">
      <span className="bonanza-mascot-sprite" style={{backgroundPosition:`${view.column/3*100}% ${view.row*100}%`}}
        onAnimationEnd={event=>{
          if(view.transient&&event.target===event.currentTarget&&event.animationName==='bonanza-mascot-outcome')setFinishedVisual(visual);
        }}/>
    </div>
  </div>;
}
