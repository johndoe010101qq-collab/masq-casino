import {PLINKO_FILM_VIEWS} from './plinko-film-metadata-v47.js';

// The supplied camera and whole-character gestures are visual calibration.
// Flight admission, stakes and deadlines remain controller-owned.
export const PLINKO_FILM = Object.freeze({
  width:1920,height:1080,fps:30,frames:34,gestureMs:34000/30,
  releaseMs:17000/30,handoffMs:19000/30,tubeMs:360,
  actor:PLINKO_FILM_VIEWS.desktop.actor,
  mobile:{width:720,height:960,scale:5/6,x:-440,y:42},
  centerX:960,ballRadius:PLINKO_FILM_VIEWS.desktop.ballRadius,
});
const clamp=value=>Math.max(0,Math.min(1,value));
const mix=(a,b,t)=>a+(b-a)*t;
export const plinkoFilmView=mobile=>PLINKO_FILM_VIEWS[mobile===true||mobile==='mobile'?'mobile':'desktop'];

export function plinkoFilmProjection(width,height,mobile=false) {
  const view=plinkoFilmView(mobile),source=view.frame,scale=height/source.height;
  const nativeX=(width-source.width*scale)/2,nativeY=0;
  // point() preserves the desktop-master API. Native camera footage, atlas
  // crops, hand tracks and label rectangles use nativePoint().
  const factor=scale*(mobile?5/6:1),x=nativeX+(mobile?-440*scale:0),y=mobile?42*scale:0;
  return {width,height,factor,x,y,mobile,view,nativeFactor:scale,nativeX,nativeY,
    point:(px,py)=>({x:x+px*factor,y:y+py*factor}),
    nativePoint:(px,py)=>({x:nativeX+px*scale,y:nativeY+py*scale}),
    binAnchors:view.labels.map(label=>({
      x:nativeX+(label.x+label.w/2)*scale,y:(label.y+label.h/2)*scale,
      width:label.w*scale,height:label.h*scale,
    })),
  };
}

const pegAt=(view,row,branch)=>view.pegs[row*(row+1)/2+(branch+row)/2];
const contact=(view,peg)=>({x:peg.x,y:peg.y-view.pegRadius-view.ballRadius});

// The filmed pins have square caps. Clear the current cap sideways before
// falling, instead of drawing a straight chord through its corner. Only this
// segment's accepted prefix is inspected; no prize or bin is requested.
export function plinkoFilmBoardPose(path,progress,mobile=false) {
  const view=plinkoFilmView(mobile),s=clamp(progress)*9;
  const first=contact(view,view.pegs[0]);
  if(s<1){
    // The feed tube is behind the pin plane. Reveal the ball at its visible
    // front edge so its full radius does not appear inside the first cap.
    return {x:first.x,y:first.y-(1-s*s)*view.ballRadius*.8,row:-1,rowPhase:s};
  }
  const row=Math.min(7,Math.floor(s)-1),u=s>=9?1:s-row-1;
  const peg=pegAt(view,row,path[row]),a=contact(view,peg),next=path[row+1];
  const b=row===7?view.landing[(next+8)/2]:contact(view,pegAt(view,row+1,next));
  const across=1-(1-u)**3,fall=clamp((u-.42)/.58);
  return {x:mix(a.x,b.x,across),y:mix(a.y,b.y,fall*fall)-view.ballRadius*.12*Math.sin(Math.PI*u),
    row,rowPhase:u,contact:peg};
}

function trackedBall(view,group,frame){
  const track=view.clips[group.clip].track,hand=group.side==='left'?'R':'L';
  const index=Math.max(0,Math.min(track.length-1,Math.floor(frame))),next=Math.min(track.length-1,index+1);
  const a=track[index][hand],b=track[next][hand],u=clamp(frame-index);
  return {x:mix(a[0],b[0],u),y:mix(a[1],b[1],u)};
}

/** A gesture can represent an arbitrary burst, without a queue of paid rounds.
 * At frame 19 an after-clip can take over while the first hand returns. Raw
 * render/hand tracks match; separately encoded H.264 frames have small
 * quantisation differences. Lossless atlas derivatives add no further loss;
 * they do not turn the decoded H.264 handoffs into pixel-identical frames. */
export class PlinkoFilmBatches {
  constructor(){this.bindings=new Map();this.groups=[];this.sequence=0;}
  update(flights,clock,duration=3800,reduced=false) {
    const alive=new Set(flights.map(f=>f.id));
    for(const id of this.bindings.keys())if(!alive.has(id))this.bindings.delete(id);
    this.groups=this.groups.filter(group=>group.end>=clock);
    for(const flight of flights){
      if(this.bindings.has(flight.id))continue;
      const start=clock-flight.progress*duration,end=start+duration;
      let group=this.groups.at(-1);
      // A media-loading or reduced-motion batch never wakes up halfway through
      // an old paid flight when decoding finishes or the preference changes.
      if(group?.disabled&&!reduced){this.groups=[];group=null;}
      if(!group||group.release<clock){
        const previous=group,side=this.sequence++%2?'right':'left';
        const handoff=previous&&clock<=previous.start+PLINKO_FILM.handoffMs;
        const at=previous?Math.max(clock,handoff?previous.start+PLINKO_FILM.handoffMs:previous.end):clock;
        const clip=handoff?`drop_${side}_after_${previous.side}`:`drop_${side}`;
        if(handoff)previous.end=at;
        group={start:at,end:at+PLINKO_FILM.gestureMs,release:at+PLINKO_FILM.releaseMs,side,clip,disabled:reduced};
        this.groups.push(group);
      }
      const fallback=reduced||group.release+PLINKO_FILM.tubeMs>end-duration*.48;
      this.bindings.set(flight.id,{group,start,release:fallback?clock:group.release,
        inlet:fallback?clock:group.release+PLINKO_FILM.tubeMs,fallback});
    }
    return this;
  }
  action(clock,reduced=false){
    if(reduced)return null;
    const group=this.groups.find(g=>clock>=g.start&&clock<g.end);
    if(!group||group.disabled)return null;
    const time=clock-group.start;
    return {...group,frame:Math.min(33,Math.floor(time*30/1000)),
      opacity:group.clip.includes('_after_')?1:Math.min(1,time/40)};
  }
  pose(flight,clock,duration=3800,reduced=false,mobile=false){
    const view=plinkoFilmView(mobile),binding=this.bindings.get(flight.id);
    const start=clock-flight.progress*duration,end=start+duration;
    // A speed preference may shorten an accepted flight's deadline. Fall
    // back to the nozzle; media readiness cannot hold a pending settlement.
    const fallback=reduced||!binding||binding.fallback||binding.inlet>end-duration*.35;
    const inlet=fallback?start:binding.inlet;
    if(clock<inlet){
      const frame=(clock-binding.group.start)*30/1000;
      if(frame<12)return {visible:false};
      if(clock<=binding.release)return {visible:true,...trackedBall(view,binding.group,frame),radius:view.mouthRadius,phase:'held'};
      const released=trackedBall(view,binding.group,17),dt=(clock-binding.release)*30/1000;
      const y=released.y+1.1*dt*dt;
      if(y>=view.mouth.throat_centre[1])return {visible:false};
      return {visible:true,x:mix(released.x,view.mouth.throat_centre[0],clamp(dt/7)),y,
        radius:view.mouthRadius,phase:'mouth',behindInlet:true};
    }
    const progress=clamp((clock-inlet)/Math.max(1,end-inlet));
    return {...plinkoFilmBoardPose(flight.path,progress,mobile),visible:true,radius:view.ballRadius,
      phase:'board',boardProgress:progress};
  }
}
