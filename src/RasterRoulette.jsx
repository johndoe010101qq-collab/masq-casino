import React, { useEffect, useRef } from 'react';
import { ROULETTE_NUMBERS } from './game-math.js';
import { rasterRoulettePose } from './raster-roulette-motion.js';
import './RasterRoulette.css';

const red = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
export default function RasterRoulette({ round, progress, playing }) {
  const canvas = useRef(null);
  useEffect(() => {
    const ctx = canvas.current?.getContext('2d');
    if (!ctx) return;
    const size=1000,center=size/2,step=Math.PI*2/37;
    ctx.clearRect(0,0,size,size);
    ROULETTE_NUMBERS.forEach((number,index)=>{
      const angle=index*step-Math.PI/2;
      ctx.beginPath();ctx.arc(center,center,397,angle-step/2,angle+step/2);
      ctx.arc(center,center,265,angle+step/2,angle-step/2,true);ctx.closePath();
      ctx.fillStyle=number===0?'#287357':red.has(number)?'#a63740':'#112128';ctx.fill();
      ctx.lineWidth=3;ctx.strokeStyle='#e8cb8c';ctx.stroke();
      ctx.save();ctx.translate(center+Math.cos(angle)*357,center+Math.sin(angle)*357);
      ctx.rotate(angle+Math.PI/2);ctx.font='bold 24px Arial';ctx.fillStyle='#f7e8c4';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),0,0);ctx.restore();
    });
    [265,397].forEach(radius=>{ctx.beginPath();ctx.arc(center,center,radius,0,Math.PI*2);ctx.lineWidth=5;ctx.strokeStyle='#f3dba4';ctx.stroke();});
  },[]);
  const pose=rasterRoulettePose(round?.pocketIndex??0,playing?progress:round?1:0);
  return <div className="roulette-illustrated" aria-hidden="true"><div className="roulette-raster-wheel">
    <img className="roulette-painted-body" src={import.meta.env.BASE_URL+'roulette-painted-body.png'} alt=""/>
    <canvas width="1000" height="1000" ref={canvas} style={{transform:`rotate(${pose.wheelDegrees}deg)`}}/>
    <i className="roulette-raster-ball" style={{left:pose.ballX+'%',top:pose.ballY+'%'}}/>
  </div></div>;
}
