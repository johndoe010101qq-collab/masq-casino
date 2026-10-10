import React,{useState} from 'react';
import {getHouseMascotPresentation} from './house-mascot-presentation.js';
import './HouseMascot.css';
import './HouseCommercialArt.css';

// Six raster poses plus a four-frame dance. This decoration reads
// the accepted presentation only; it has no independent financial/round clock.
export default function HouseMascot({game,visual,reducedMotion=false}) {
  const [finishedVisual,setFinishedVisual]=useState(null);
  const presentation=getHouseMascotPresentation(visual,game,finishedVisual);
  if(!presentation.visible)return null;
  const {pose,frame,transient}=presentation;
  return <div className="house-mascot" aria-hidden="true" data-pose={pose}
    data-transient={transient} data-reduced-motion={reducedMotion}>
    <div className="house-mascot-viewport"><div key={pose+':'+presentation.reactionKey} className="house-mascot-body">
      <span className="house-mascot-sprite" style={{'--house-frame':`${frame*20}%`,backgroundPosition:`${frame*20}% 0%`}}
        onAnimationEnd={event=>{
          if(transient&&event.target===event.currentTarget&&event.animationName==='house-mascot-outcome')setFinishedVisual(visual);
        }}/>
    </div></div>
  </div>;
}
