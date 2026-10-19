import React,{useMemo} from 'react';
import ClassicFilmStage from './ClassicFilmStage.jsx';
import {diceFilmAcceptedValue,diceFilmPresentation} from './dice-film-presentation.js';

export default function DiceFilm({round,progress,playing,reduced=false,visible=true}){
  const value=useMemo(()=>diceFilmAcceptedValue(round),[round?.id]);
  const pose=diceFilmPresentation(value,progress,playing,reduced);
  return <div aria-hidden="true" data-dice-phase={pose.phase} data-dice-settled={pose.settled}
    style={{position:'absolute',inset:0}}>
    <ClassicFilmStage sourceSpace basePath="/classic-films-v49/dice" clip={pose.clip}
      token={round?.id??'idle'} mediaProgress={pose.progress} reduced={reduced} visible={visible} />
  </div>;
}
