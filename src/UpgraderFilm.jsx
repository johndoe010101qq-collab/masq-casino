import React,{useState} from 'react';
import ClassicFilmStage from './ClassicFilmStage.jsx';
import {upgraderFilmMatrix,upgraderFilmPresentation} from './upgrader-film-presentation.js';
import './UpgraderHacker.css';
import './UpgraderFilm.css';
export default function UpgraderFilm({round,progress,playing,targetChoice=2,reduced=false,visible=true}){
 const [layout,setLayout]=useState(null),pose=upgraderFilmPresentation(round,progress,playing,targetChoice,reduced);
 return <div className="hacker-workstation minecraft-terminal upgrader-film" aria-hidden="true">
  <ClassicFilmStage basePath="/classic-films-v47/upgrader" clip={pose.clip} token={round?.id??'idle'}
    mediaProgress={pose.progress} reduced={reduced} visible={visible} onLayout={setLayout}>
   {layout&&<div className="upgrader-film-source" style={{left:layout.x,top:layout.y,
     width:layout.sourceWidth,height:layout.sourceHeight,transform:`scale(${layout.factor})`}}>
    <div className={'upgrader-film-screen outcome-'+pose.outcome}
      style={{transform:`matrix3d(${upgraderFilmMatrix(layout.mobile).join(',')})`}}>
     <span>{pose.screenLabel}</span><strong>×{pose.multiplier}</strong>
     <i><b style={{width:`${pose.fill*100}%`}} /></i>
    </div>
   </div>}
  </ClassicFilmStage>
 </div>;
}
