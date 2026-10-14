// Calibration in the supplied 1920×1080 footage. These are presentation
// coordinates, never RNG, prize weights, admission rules or settlement times.
export const PLINKO_FILM = Object.freeze({
  width:1920,height:1080,fps:30,frames:34,gestureMs:34000/30,
  releaseMs:17000/30,tubeMs:360,
  actor:{x:680,y:0,width:560,height:400,columns:5},
  mobile:{width:720,height:960,scale:5/6,x:-440,y:42},
  centerX:960,halfStep:30.9,firstContactY:459,rowStep:48.2,
  landingY:864,labelY:937,ballRadius:7,
});
const clamp=value=>Math.max(0,Math.min(1,value));
const mix=(a,b,t)=>a+(b-a)*t;

export function plinkoFilmProjection(width,height,mobile=false) {
  const source=mobile?PLINKO_FILM.mobile:PLINKO_FILM;
  // Fit the complete vertical machine, even in a wide, short desktop window.
  // Narrow layouts crop only the spare walls, never the host or catch trays.
  const scale=height/source.height;
  const ox=(width-source.width*scale)/2,oy=(height-source.height*scale)/2;
  const nativeScale=mobile?source.scale:1;
  const factor=scale*nativeScale;
  const x=ox+(mobile?source.x*scale:0),y=oy+(mobile?source.y*scale:0);
  return {width,height,factor,x,y,mobile,
    point:(px,py)=>({x:x+px*factor,y:y+py*factor}),
    binAnchors:Array.from({length:9},(_,i)=>({
      x:x+(960+(i-4)*61.8)*factor,y:y+937*factor,width:44*factor,height:30*factor,
    })),
  };
}

// Eight branch segments, then the separate final catch-tray anchor. Reading
// only the current path prefix prevents the future prize from cueing the host.
export function plinkoFilmBoardPose(path,progress) {
  const s=clamp(progress)*9;
  if(s<1)return {x:960,y:449+10*s*s,row:-1,phase:s};
  const row=Math.min(7,Math.floor(s)-1),u=s>=9?1:s-row-1;
  const x0=960+path[row]*30.9,x1=960+path[row+1]*30.9;
  const y0=459+row*48.2,y1=row===7?864:459+(row+1)*48.2;
  return {x:mix(x0,x1,u),y:mix(y0,y1,u)-56*u*(1-u),row,phase:u};
}

/** Whole-character gesture batches, not a queue of paid rounds. A fast group
 * shares one hand motion. begin/complete and every flight deadline belong only
 * to PlinkoFlightController; media readiness cannot postpone them. */
export class PlinkoFilmBatches {
  constructor(){this.bindings=new Map();this.groups=[];this.sequence=0;}
  update(flights,clock,duration=3800,reduced=false) {
    const alive=new Set(flights.map(f=>f.id));
    for(const id of this.bindings.keys())if(!alive.has(id))this.bindings.delete(id);
    this.groups=this.groups.filter(group=>group.start+PLINKO_FILM.gestureMs>=clock);
    for(const flight of flights){
      if(this.bindings.has(flight.id))continue;
      const start=clock-flight.progress*duration,end=start+duration;
      let group=this.groups.at(-1);
      if(!group||group.release<clock){
        const at=Math.max(clock,group?group.start+PLINKO_FILM.gestureMs:clock);
        group={start:at,release:at+PLINKO_FILM.releaseMs,side:this.sequence++%2?'right':'left'};
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
    const group=this.groups.find(g=>clock>=g.start&&clock<g.start+PLINKO_FILM.gestureMs);
    if(!group)return null;
    const time=clock-group.start;
    return {...group,frame:Math.min(33,Math.floor(time*30/1000)),
      opacity:Math.min(1,time/65,(PLINKO_FILM.gestureMs-time)/65)};
  }
  pose(flight,clock,duration=3800,reduced=false){
    const binding=this.bindings.get(flight.id);
    const start=clock-flight.progress*duration,end=start+duration;
    // A live speed/motion change may shorten an existing deadline. Fall back
    // to the nozzle instead of leaving a settled round waiting in a hand.
    const fallback=reduced||!binding||binding.fallback||binding.inlet>end-duration*.35;
    const inlet=fallback?start:binding.inlet;
    if(clock<inlet){
      const time=clock-binding.group.start;
      if(time<8/30*1000)return {visible:false};
      const side=binding.group.side==='left'?1:-1;
      const held=[[8,770,335],[12,795,316],[15,915,300],[17,950,294]];
      if(clock<binding.release){
        const frame=Math.min(17,time*30/1000);
        let index=0;while(index<held.length-2&&frame>held[index+1][0])index++;
        const a=held[index],b=held[index+1],u=clamp((frame-a[0])/(b[0]-a[0]));
        return {visible:true,x:960+side*(mix(a[1],b[1],u)-960),y:mix(a[2],b[2],u),phase:'held'};
      }
      const u=(clock-binding.release)/160;
      if(u>1)return {visible:false}; // behind the physical inlet and throat
      return {visible:true,x:960-side*10*(1-u),y:294+31*u-9*4*u*(1-u),phase:'mouth'};
    }
    const progress=clamp((clock-inlet)/Math.max(1,end-inlet));
    return {...plinkoFilmBoardPose(flight.path,progress),visible:true,phase:'board',boardProgress:progress};
  }
}
