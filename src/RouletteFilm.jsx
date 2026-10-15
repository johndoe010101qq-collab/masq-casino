import React,{useCallback,useEffect,useId,useLayoutEffect,useMemo,useRef,useState} from 'react';
import ClassicFilmStage from './ClassicFilmStage.jsx';
import {ROULETTE_FILM,rouletteFilmPose,rouletteFilmProject,rouletteFilmNumbers,rouletteFilmView,rouletteFilmOverlayVisible,
  rouletteFilmCamera,rouletteFilmRotorMesh,rouletteFilmTriangleTransform,rouletteFilmFrets,rouletteFilmRingPath,
  rouletteFilmHubMask,rouletteFilmRotorBounds} from './roulette-film-presentation.js';
import './RouletteFilm.css';

function polygon(context,points){
  context.beginPath();points.forEach((point,index)=>index?context.lineTo(...point):context.moveTo(...point));context.closePath();
}

/** A small raster canvas, redrawn only by the existing round progress. It
 * reprojects the supplied top-down material; it owns no animation clock. */
function RasterRotor({layout,angle,visible}){
  const canvas=useRef(null),[texture,setTexture]=useState(null);
  const mobile=layout.mobile,bounds=useMemo(()=>rouletteFilmRotorBounds(mobile),[mobile]);
  useEffect(()=>{
    let alive=true;const image=new Image();image.onload=()=>{if(alive)setTexture(image);};
    image.src='/classic-films-v47/roulette/rotor.webp';
    return()=>{alive=false;image.onload=null;};
  },[]);
  useLayoutEffect(()=>{
    if(!texture||!canvas.current||!visible)return;
    const node=canvas.current,dpr=Math.min(2,window.devicePixelRatio||1),ratio=layout.factor*dpr;
    const width=Math.max(1,Math.ceil(bounds.width*ratio)),height=Math.max(1,Math.ceil(bounds.height*ratio));
    if(node.width!==width)node.width=width;if(node.height!==height)node.height=height;
    const context=node.getContext('2d');if(!context)return;
    context.setTransform(1,0,0,1,0,0);context.clearRect(0,0,width,height);
    context.setTransform(ratio,0,0,ratio,-bounds.x*ratio,-bounds.y*ratio);
    context.fillStyle='#233029';context.fill(new Path2D(rouletteFilmRingPath(4.26,6.94,15.05,0,mobile)));
    context.imageSmoothingEnabled=true;
    for(const triangle of rouletteFilmRotorMesh(angle,mobile)){
      const matrix=rouletteFilmTriangleTransform(triangle.source,triangle.target);if(!matrix)continue;
      const cx=triangle.target.reduce((sum,p)=>sum+p[0],0)/3,cy=triangle.target.reduce((sum,p)=>sum+p[1],0)/3;
      const clip=triangle.target.map(([x,y])=>{const length=Math.hypot(x-cx,y-cy)||1;return [x+(x-cx)*.17/length,y+(y-cy)*.17/length];});
      context.save();polygon(context,clip);context.clip();context.transform(...matrix);context.drawImage(texture,0,0);context.restore();
    }
    // The top-down texture also contains the fret tops. Raised faces cover
    // those texels with their real height and produce physical depth.
    for(const face of rouletteFilmFrets(angle,mobile)){
      polygon(context,face.points);context.fillStyle=face.fill;context.fill();
      context.strokeStyle='#24352c';context.lineWidth=.32;context.stroke();
    }
  },[texture,angle,visible,mobile,layout.factor,bounds]);
  return <canvas ref={canvas} className="roulette-raster-rotor" aria-hidden="true"
    style={{left:layout.x+bounds.x*layout.factor,top:layout.y+bounds.y*layout.factor,
      width:bounds.width*layout.factor,height:bounds.height*layout.factor}} />;
}

/** The film supplies the actor and outer bowl. All moving rotor parts use one
 * transform; only the original runner supplies progress and accepted result. */
export default function RouletteFilm({round,progress,playing,reduced=false,visible=true}){
  const [layout,setLayout]=useState(null),[decoded,setDecoded]=useState(null);
  const onLayout=useCallback(next=>setLayout(next),[]);
  const onMediaFrame=useCallback(next=>setDecoded(previous=>
    previous?.token===next.token&&previous?.src===next.src&&previous?.released===(next.frame>=36)
      ?previous:{token:next.token,src:next.src,released:next.frame>=36}),[]);
  const id=useId().replace(/:/g,''),mobile=layout?.mobile??false,view=rouletteFilmView(mobile);
  const pose=rouletteFilmPose(round,progress,playing,reduced);
  const numbers=useMemo(()=>rouletteFilmNumbers(mobile,pose.rotorAngle),[mobile,pose.rotorAngle]);
  const hub=useMemo(()=>rouletteFilmHubMask(mobile),[mobile]);
  const showBall=rouletteFilmOverlayVisible(pose,decoded,round?.id??'idle',mobile);
  const ball=rouletteFilmProject(pose.position,mobile);
  const shadow=rouletteFilmProject([pose.position[0],pose.position[1]-ROULETTE_FILM.ballRadius,pose.position[2]],mobile);
  const rimPath='M'+view.rimFront.map(point=>point.join(',')).join('L')+'Z';
  const settled=pose.phase==='settled';
  const selected=settled?rouletteFilmRingPath(4.62,5.86,14.53,pose.rotorAngle,mobile,
    (pose.pocketIndex-.46)*Math.PI*2/37,(pose.pocketIndex+.46)*Math.PI*2/37):'';
  const camera=rouletteFilmCamera(pose.progress,mobile,reduced);
  const poster='/classic-films-v47/roulette/'+(mobile?'mobile':'desktop')+'/poster.webp';
  return <>
    <ClassicFilmStage game="roulette" basePath="/classic-films-v47/roulette" className="roulette-film"
      clip={round?'release':'idle'} token={round?.id??'idle'} mediaProgress={pose.mediaProgress} camera={camera}
      playing={playing} reduced={reduced} visible={visible} onLayout={onLayout} onMediaFrame={onMediaFrame}>
      {layout&&<>
        <RasterRotor layout={layout} angle={pose.rotorAngle} visible={visible} />
        <svg className="roulette-film-projection" aria-hidden="true" viewBox={`0 0 ${view.width} ${view.height}`}
          style={{left:layout.x,top:layout.y,width:view.width*layout.factor,height:view.height*layout.factor,pointerEvents:'none'}}>
          <defs>
            <mask id={'roulette-rim-'+id} maskUnits="userSpaceOnUse" x="0" y="0" width={view.width} height={view.height}>
              <rect width={view.width} height={view.height} fill="white" /><path d={rimPath} fill="black" />
            </mask>
            <clipPath id={'roulette-hub-'+id}>{hub.map((path,index)=><path key={index} d={path} />)}</clipPath>
            <radialGradient id={'roulette-ball-'+id} cx="32%" cy="27%" r="74%">
              <stop offset="0" stopColor="#fffef0" /><stop offset=".38" stopColor="#eeecd9" />
              <stop offset=".78" stopColor="#b7c2af" /><stop offset="1" stopColor="#626e66" />
            </radialGradient>
          </defs>
          {settled&&<path d={selected} className="roulette-accepted-pocket" />}
          <g className="roulette-rotor-numbers" textAnchor="middle" dominantBaseline="central">
            {numbers.map(number=><text key={number.index} transform={'matrix('+number.matrix.join(' ')+')'}
              data-pocket={number.index}>{number.number}</text>)}
          </g>
          <image href={poster} width={view.width} height={view.height} clipPath={'url(#roulette-hub-'+id+')'} />
          {showBall&&<g mask={'url(#roulette-rim-'+id+')'} data-phase={pose.phase}>
            <ellipse cx={shadow.x} cy={shadow.y} rx={ball.radius*.9} ry={ball.radius*.32} fill="#030805" opacity=".5" />
            <circle cx={ball.x} cy={ball.y} r={ball.radius} fill={'url(#roulette-ball-'+id+')'}
              stroke="#f0f1dd" strokeWidth={Math.max(.3,ball.radius*.025)} />
          </g>}
        </svg>
      </>}
    </ClassicFilmStage>
    {settled&&<div className={'roulette-film-result roulette-film-result--'+pose.color} role="status" aria-live="polite">
      <strong className="roulette-film-result__number">{pose.number}</strong>
      <span><small>ВЫПАЛО</small><b>{pose.color==='red'?'КРАСНОЕ':pose.color==='black'?'ЧЁРНОЕ':'ЗЕРО'}</b></span>
    </div>}
  </>;
}
