import React, { useMemo } from 'react';
import ClassicFilmStage from './ClassicFilmStage.jsx';
import { coinFilmAcceptedFace, coinFilmPresentation } from './coin-film-presentation.js';

export default function CoinflipFilm({ round, progress, playing, reduced = false, visible = true }) {
  const face = useMemo(() => coinFilmAcceptedFace(round), [round?.id]);
  const pose = coinFilmPresentation(face, progress, playing, reduced);
  return <div className="coinflip-film" aria-hidden="true" data-coin-phase={pose.phase}
    data-coin-settled={pose.settled} style={{ width: '100%', height: '100%' }}>
    <ClassicFilmStage basePath="/classic-films-v47/coinflip" clip={pose.clip}
      token={round?.id ?? 'idle'} mediaProgress={pose.progress}
      playing={playing} reduced={reduced} visible={visible} camera={pose.camera} />
  </div>;
}
