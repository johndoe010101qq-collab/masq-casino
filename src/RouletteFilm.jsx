import React,{useCallback,useState} from 'react';
import ClassicFilmStage from './ClassicFilmStage.jsx';
import RouletteWheelScene from './RouletteWheelScene.jsx';
import {rouletteFilmPose,rouletteFilmOverlayVisible,rouletteFilmCamera} from './roulette-film-presentation.js';
import './RouletteFilm.css';

export default function RouletteFilm({round,progress,playing,reduced=false,visible=true}){
  const [layout,setLayout]=useState(null),[decoded,setDecoded]=useState(null);
  const onLayout=useCallback(next=>setLayout(next),[]);
  const onMediaFrame=useCallback(next=>setDecoded(previous=>
    previous?.token===next.token&&previous?.src===next.src&&previous?.released===(next.frame>=36)
      ?previous:{token:next.token,src:next.src,released:next.frame>=36}),[]);
  const mobile=layout?.mobile??false,pose=rouletteFilmPose(round,progress,playing,reduced);
  const showBall=rouletteFilmOverlayVisible(pose,decoded,round?.id??'idle',mobile);
  return <>
    <ClassicFilmStage sourceSpace basePath="/classic-films-v47/roulette" className="roulette-film"
      clip={round?'release':'idle'} token={round?.id??'idle'} mediaProgress={pose.mediaProgress}
      camera={rouletteFilmCamera(pose.progress,mobile,reduced)} reduced={reduced} visible={visible}
      onLayout={onLayout} onMediaFrame={onMediaFrame}>
      {layout&&<RouletteWheelScene layout={layout} pose={pose} showBall={showBall} visible={visible} />}
    </ClassicFilmStage>
    {pose.phase==='settled'&&<div className={'roulette-film-result roulette-film-result--'+pose.color} role="status" aria-live="polite">
      <strong className="roulette-film-result__number">{pose.number}</strong>
      <span><small>ВЫПАЛО</small><b>{pose.color==='red'?'КРАСНОЕ':pose.color==='black'?'ЧЁРНОЕ':'ЗЕРО'}</b></span>
    </div>}
  </>;
}
