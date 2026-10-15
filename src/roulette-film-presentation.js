import {ROULETTE_NUMBERS, rouletteColor} from './game-math.js';
import {ROULETTE_FILM_CALIBRATION as calibration} from './roulette-film-calibration.js';

const TAU=Math.PI*2;
const clamp=value=>Math.max(0,Math.min(1,Number.isFinite(value)?value:0));
const smooth=value=>{const t=clamp(value);return t*t*t*(10+t*(-15+6*t));};
const hermite=(a,b,velocityA,velocityB,time,span)=>{
  const t=clamp(time/span),t2=t*t,t3=t2*t;
  return (2*t3-3*t2+1)*a+(-2*t3+3*t2)*b+(t3-2*t2+t)*span*velocityA+(t3-t2)*span*velocityB;
};
const center=Object.freeze([0,14.5,4.6]);
const release=Object.freeze([...calibration.release.position]);
const velocity=Object.freeze([...calibration.release.velocity]);
const x=release[0]-center[0],z=release[2]-center[2],releaseRadius=Math.hypot(x,z);
const releaseAngle=Math.atan2(x,z);
const radialVelocity=(x*velocity[0]+z*velocity[2])/releaseRadius;
const angularVelocity=(z*velocity[0]-x*velocity[2])/(releaseRadius*releaseRadius);

export const ROULETTE_FILM=Object.freeze({
  fps:30,frames:82,lastFrame:81,releaseFrame:36,releaseSeconds:36/30,
  filmSeconds:81/30,roundSeconds:6,reveal:.82,landing:.98,
  center,releasePosition:release,releaseVelocity:velocity,releaseRadius,releaseAngle,
  releaseRadialVelocity:radialVelocity,releaseAngularVelocity:angularVelocity,
  entrySeconds:.42,decay:.12,trackRadius:9,trackY:16.19,rotorTurns:2,
  pocketRadius:5.25,pocketY:14.92,numberRadius:6.35,numberY:15,ballRadius:.42,
});

/** The original off-axis camera has no lookAt rotation. Using the supplied
 * projection, rather than an ellipse fit, also keeps an airborne handoff exact. */
export function rouletteFilmProject(position,mobile=false){
  const view=calibration.views[mobile?'mobile':'desktop'];
  const [ex,ey,ez]=view.eye,[px,py,pz]=position;
  const depth=ez/(ez-pz);
  return {x:view.width/2+view.s*((px-ex)*depth+ex-view.xCentre),
    y:view.s*(view.y1-ey-(py-ey)*depth),scale:view.s*depth,
    radius:ROULETTE_FILM.ballRadius*view.s*depth};
}

export function rouletteFilmProjection(width,height,mobile=false){
  const view=calibration.views[mobile?'mobile':'desktop'];
  const factor=height/view.height,x=(width-view.width*factor)/2,y=0;
  return {width,height,mobile,factor,x,y,sourceWidth:view.width,sourceHeight:view.height,
    point:position=>{const point=rouletteFilmProject(position,mobile);return {
      x:x+point.x*factor,y:y+point.y*factor,radius:point.radius*factor};},
  };
}

export function rouletteFilmView(mobile=false){return calibration.views[mobile?'mobile':'desktop'];}

/** Colour, frets and glyphs share one rigid rotor transform. */
export function rouletteFilmNumbers(mobile=false,rotorAngle=0){
  return ROULETTE_NUMBERS.map((number,index)=>{
    const angle=index*TAU/37+rotorAngle,sin=Math.sin(angle),cos=Math.cos(angle);
    const position=[sin*ROULETTE_FILM.numberRadius,ROULETTE_FILM.numberY,center[2]+cos*ROULETTE_FILM.numberRadius];
    const point=rouletteFilmProject(position,mobile);
    const tangent=rouletteFilmProject([position[0]+cos*.01,position[1],position[2]-sin*.01],mobile);
    const radial=rouletteFilmProject([position[0]+sin*.01,position[1],position[2]+cos*.01],mobile);
    return {index,number,color:rouletteColor(number),position,x:point.x,y:point.y,
      matrix:[(tangent.x-point.x)/.01,(tangent.y-point.y)/.01,
        (radial.x-point.x)/.01,(radial.y-point.y)/.01,point.x,point.y]};
  });
}

export function rouletteFilmRotor(progress){
  const q=clamp(progress/ROULETTE_FILM.landing);
  return {angle:-TAU*ROULETTE_FILM.rotorTurns*smooth(q),
    velocity:-TAU*ROULETTE_FILM.rotorTurns*30*q*q*(1-q)*(1-q)/(ROULETTE_FILM.landing*6)};
}

export function rouletteFilmCamera(progress,mobile=false,reduced=false){
  const p=clamp(progress),inward=smooth((p-.18)/.30),outward=smooth((p-.90)/.10);
  // The mobile source has380px of spare wall over the hood. A static tighter
  // composition uses that space even before a round, including reduced mode.
  // Desktop's full hood-to-bowl span only permits1.34× without clipping.
  const base=mobile?1.55:1.10,action=mobile ? .30 : .24;
  return {scale:base+(reduced?0:action*inward*(1-.32*outward)),
    originX:mobile?360:960,originY:mobile?760:755};
}

const ringPoint=(radius,angle,y)=>[Math.sin(angle)*radius,y,center[2]+Math.cos(angle)*radius];
const projectedPoint=(position,mobile)=>{const p=rouletteFilmProject(position,mobile);return [p.x,p.y];};

/** Triangle texture mapping keeps the supplied pixel material, not a flat
 * replacement wheel. UVs are the user's top-down plate (half-height11.5).
 * Every destination is projected through the film's original camera. */
export function rouletteFilmRotorMesh(rotorAngle,mobile=false){
  const bands=[[4.30,4.60,15.05],[4.60,5.90,14.5],[5.90,6.90,15.0]],triangles=[];
  const textureScale=1080/23;
  for(const [r0,r1,y] of bands)for(let i=0;i<148;i++){
    const a=i*TAU/148,b=(i+1)*TAU/148;
    const corners=[[r0,a],[r1,a],[r1,b],[r0,b]];
    const points=corners.map(([r,angle])=>ringPoint(r,angle+rotorAngle,y));
    const target=points.map(point=>projectedPoint(point,mobile));
    const source=corners.map(([r,angle])=>[336+Math.sin(angle)*r*textureScale,336+Math.cos(angle)*r*textureScale]);
    for(const indices of [[0,1,2],[0,2,3]])triangles.push({source:indices.map(j=>source[j]),target:indices.map(j=>target[j]),
      depth:indices.reduce((sum,j)=>sum+points[j][2],0)/3});
  }
  return triangles.sort((a,b)=>a.depth-b.depth);
}

export function rouletteFilmTriangleTransform(source,target){
  const [[x0,y0],[x1,y1],[x2,y2]]=source,[[u0,v0],[u1,v1],[u2,v2]]=target;
  const dx1=x1-x0,dy1=y1-y0,dx2=x2-x0,dy2=y2-y0,det=dx1*dy2-dx2*dy1;
  if(Math.abs(det)<1e-10)return null;
  const a=((u1-u0)*dy2-(u2-u0)*dy1)/det,c=(dx1*(u2-u0)-dx2*(u1-u0))/det;
  const b=((v1-v0)*dy2-(v2-v0)*dy1)/det,d=(dx1*(v2-v0)-dx2*(v1-v0))/det;
  return [a,b,c,d,u0-a*x0-c*y0,v0-b*x0-d*y0];
}

/** Real raised separators, including their visible sidewalls. */
export function rouletteFilmFrets(rotorAngle,mobile=false){
  const faces=[];
  for(let index=0;index<37;index++){
    const a=(index+.5)*TAU/37+rotorAngle,sin=Math.sin(a),cos=Math.cos(a);
    const corners=[];
    for(const y of [14.475,15.025])for(const r of [4.6,5.9])for(const t of [-.08,.08])
      corners.push([sin*r+cos*t,y,center[2]+cos*r-sin*t]);
    const add=(indices,fill)=>faces.push({points:indices.map(i=>projectedPoint(corners[i],mobile)),fill,
      depth:indices.reduce((sum,i)=>sum+corners[i][2],0)/indices.length});
    add([4,5,7,6],'#718079');
    if(sin>=0)add([0,2,6,4],'#3d4c44');else add([1,5,7,3],'#4b5951');
    if(cos>=0)add([2,3,7,6],'#53635a');else add([0,4,5,1],'#34453c');
  }
  return faces.sort((a,b)=>a.depth-b.depth);
}

export function rouletteFilmRingPath(inner,outer,y,rotorAngle=0,mobile=false,start=0,end=TAU){
  const points=[],segments=Math.max(4,Math.ceil((end-start)/TAU*148));
  for(let i=0;i<=segments;i++)points.push(projectedPoint(ringPoint(outer,start+(end-start)*i/segments+rotorAngle,y),mobile));
  for(let i=segments;i>=0;i--)points.push(projectedPoint(ringPoint(inner,start+(end-start)*i/segments+rotorAngle,y),mobile));
  return 'M'+points.map(p=>p.join(',')).join('L')+'Z';
}

export function rouletteFilmRotorBounds(mobile=false){
  const points=[];
  for(let i=0;i<148;i++)for(const y of [14.3,15.15])points.push(rouletteFilmProject(ringPoint(7.03,i*TAU/148,y),mobile));
  const x=Math.floor(Math.min(...points.map(p=>p.x)))-2,y=Math.floor(Math.min(...points.map(p=>p.y)))-2;
  return {x,y,width:Math.ceil(Math.max(...points.map(p=>p.x)))-x+2,height:Math.ceil(Math.max(...points.map(p=>p.y)))-y+2};
}

export function rouletteFilmHubMask(mobile=false){
  const boxes=[[0,16.7,4.6,1,2.6,1],[0,17.6,4.6,4.4,.45,.45],[0,17.6,4.6,.45,.45,4.4],
    [-2.2,17.6,4.6,.8,.8,.8],[2.2,17.6,4.6,.8,.8,.8],[0,17.6,2.4,.8,.8,.8],[0,17.6,6.8,.8,.8,.8]];
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  return boxes.map(([x,y,z,w,h,d])=>{
    const points=[];for(const dx of [-w/2,w/2])for(const dy of [-h/2,h/2])for(const dz of [-d/2,d/2])
      points.push(projectedPoint([x+dx,y+dy,z+dz],mobile));
    points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
    const lower=[],upper=[];for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
    for(const p of [...points].reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
    return 'M'+lower.slice(0,-1).concat(upper.slice(0,-1)).map(p=>p.join(',')).join('L')+'Z';
  });
}

function commonOrbit(seconds){
  const age=Math.max(0,seconds-ROULETTE_FILM.releaseSeconds);
  const {decay,entrySeconds,trackRadius,trackY}=ROULETTE_FILM;
  return {
    angle:releaseAngle+angularVelocity/decay*(1-Math.exp(-decay*age)),
    angularVelocity:angularVelocity*Math.exp(-decay*age),
    radius:age<entrySeconds?hermite(releaseRadius,trackRadius,radialVelocity,0,age,entrySeconds):trackRadius,
    y:age<entrySeconds?hermite(release[1],trackY,velocity[1],0,age,entrySeconds):trackY,
  };
}

export function rouletteFilmProgress(round,progress,playing,reduced=false){
  if(!round)return 0;
  return reduced||!playing?1:clamp(progress);
}

export function rouletteFilmOverlayVisible(pose,decoded,token,mobile=false){
  return !!(pose.visible&&(pose.progress===1||(decoded?.token===String(token)&&decoded?.released&&
    decoded?.src?.endsWith('/'+(mobile?'mobile':'desktop')+'/release.mp4'))));
}

/** The action clip is scrubbed by the existing public round progress. The
 * accepted pocket is deliberately inaccessible until the late public gate. */
export function rouletteFilmPose(round,progress,playing,reduced=false){
  const p=rouletteFilmProgress(round,progress,playing,reduced),active=!!round;
  const seconds=p*ROULETTE_FILM.roundSeconds;
  const mediaProgress=active?clamp(seconds/ROULETTE_FILM.filmSeconds):0;
  const visible=active&&seconds>=ROULETTE_FILM.releaseSeconds;
  const reveal=active&&p>=ROULETTE_FILM.reveal;
  const rotor=rouletteFilmRotor(p);
  let motion=commonOrbit(seconds),pocketIndex=null;
  if(reveal){
    const raw=Number(round.pocketIndex);
    pocketIndex=Number.isInteger(raw)&&raw>=0&&raw<37?raw:0;
    const atGate=commonOrbit(ROULETTE_FILM.reveal*ROULETTE_FILM.roundSeconds);
    const span=(ROULETTE_FILM.landing-ROULETTE_FILM.reveal)*ROULETTE_FILM.roundSeconds;
    const age=(p-ROULETTE_FILM.reveal)*ROULETTE_FILM.roundSeconds;
    const gateRotor=rouletteFilmRotor(ROULETTE_FILM.reveal);
    const relativeAngle=atGate.angle-gateRotor.angle,relativeVelocity=atGate.angularVelocity-gateRotor.velocity;
    const target=pocketIndex*TAU/37;
    // A forward endpoint with sufficient distance keeps the C1 Hermite
    // trajectory monotone for every accepted sector, including the wrap.
    const minimum=relativeAngle+relativeVelocity*span/3+.025;
    const end=target+Math.ceil((minimum-target)/TAU)*TAU;
    const blend=smooth(age/span);
    const t=clamp(age/span),envelope=Math.sin(Math.PI*t)**2;
    motion={angle:hermite(relativeAngle,end,relativeVelocity,0,age,span)+rotor.angle,
      radius:atGate.radius+(ROULETTE_FILM.pocketRadius-atGate.radius)*blend+.10*Math.sin(6*Math.PI*t)*envelope,
      y:atGate.y+(ROULETTE_FILM.pocketY-atGate.y)*blend+.21*Math.sin(3*Math.PI*t)**2*envelope};
  }
  const position=[center[0]+Math.sin(motion.angle)*motion.radius,motion.y,
    center[2]+Math.cos(motion.angle)*motion.radius];
  return {progress:p,seconds,mediaProgress,visible,reveal,pocketIndex,rotorAngle:rotor.angle,rotorVelocity:rotor.velocity,
    number:pocketIndex===null?null:ROULETTE_NUMBERS[pocketIndex],color:pocketIndex===null?null:rouletteColor(ROULETTE_NUMBERS[pocketIndex]),
    phase:!active?'idle':!visible?'held':p<ROULETTE_FILM.reveal?'track':p<ROULETTE_FILM.landing?'drop':'settled',
    position,angle:motion.angle,radius:motion.radius,ballRadius:ROULETTE_FILM.ballRadius};
}
