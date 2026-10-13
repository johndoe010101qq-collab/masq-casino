import React from 'react';
import MinecraftClassicArt from './MinecraftClassicArt.jsx';
import { minecraftCoinPose } from './minecraft-classic-motion.js';
export default function RasterCoinflip({ round, progress, playing, reduced = false, visible = true }) {
  const pose = minecraftCoinPose(round, progress, playing, reduced);
  return <div className="coin-illustrated minecraft-coin" data-face-revealed={pose.reveal} data-turn-degrees={pose.turnDegrees} aria-hidden="true" style={{ width: '100%', height: '100%' }}>
    <MinecraftClassicArt game="coinflip" round={round} progress={progress} playing={playing} reduced={reduced} visible={visible} />
  </div>;
}