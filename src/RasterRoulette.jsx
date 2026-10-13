import React from 'react';
import MinecraftClassicArt from './MinecraftClassicArt.jsx';
export default function RasterRoulette({ round, progress, playing, reduced = false, visible = true }) {
  return <MinecraftClassicArt game="roulette" round={round} progress={progress} playing={playing} reduced={reduced} visible={visible} />;
}