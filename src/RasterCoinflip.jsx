import React from 'react';
import {rasterCoinPose} from './raster-coin-motion.js';
import './RasterCoinflip.css';
export default function RasterCoinflip({round,progress,playing}) {
 const p=playing?progress:round?1:0;
 const side=p>=.9?round?.face:'heads';
 const pose=rasterCoinPose(p,side);
 return <div className="coin-illustrated" aria-hidden="true"><div className="coin-painted-shadow" style={{opacity:.28-Math.abs(pose.flight)/140,transform:`scale(${1-Math.abs(pose.flight)/70},1)`}}/>
  <div className="coin-painted-flight" style={{transform:`translateY(${pose.flight}%) rotateZ(${pose.tilt}deg)`}}><div className="coin-painted-turn" style={{transform:`rotateY(${round||playing?pose.turnDegrees:0}deg)`}}>
   <div className="coin-painted-face"><img src={import.meta.env.BASE_URL+'coinflip-heads-painted.png'} alt=""/></div>
   <div className="coin-painted-face coin-painted-tails"><img src={import.meta.env.BASE_URL+'coinflip-tails-painted.png'} alt=""/><strong>I</strong></div>
  </div></div>
 </div>;
}
