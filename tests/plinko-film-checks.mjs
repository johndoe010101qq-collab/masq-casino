import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PLINKO_FILM as film,plinkoFilmProjection,plinkoFilmBoardPose,PlinkoFilmBatches} from '../src/plinko-film-presentation.js';
import {PlinkoFlightController} from '../src/plinko-controller.js';

let checks=0,maxGroups=0;
const close=(a,b,message,tolerance=1e-8)=>{assert.ok(Math.abs(a-b)<tolerance,message+': '+a+' / '+b);checks++;};
const poison=()=>{throw new Error('Future/private Plinko information was read');};
const flight=(id,progress,path)=>{
  const item={id,progress};
  for(const key of ['stake','bin','won','payout','netCents','result'])Object.defineProperty(item,key,{get:poison});
  if(path===undefined)Object.defineProperty(item,'path',{get:poison});else item.path=path;
  return Object.freeze(item);
};
const allPaths=Array.from({length:256},(_,ticket)=>{
  const path=[0];for(let row=0;row<8;row++)path.push(path.at(-1)+((ticket>>row)&1?1:-1));return Object.freeze(path);
});
const guardedPath=(path,maximum)=>new Proxy(path,{get(target,key){
  if(typeof key==='string'&&/^\d+$/.test(key)){assert.ok(Number(key)<=maximum,'Read future path['+key+'], maximum current prefix '+maximum);checks++;return target[key];}
  return poison();
}});
const outcomeOnly=Array.from({length:251},(_,i)=>flight(i+1,0));
const batches=new PlinkoFilmBatches();
batches.update(outcomeOnly,0);
assert.equal(batches.bindings.size,251,'Every immediate paid id gets a binding');checks++;
assert.equal(batches.groups.length,1,'A rapid burst shares one complete actor gesture');checks++;
const firstGroup=batches.groups[0],initialSequence=batches.sequence;
for(let repeat=0;repeat<50;repeat++){
  batches.update(outcomeOnly,0);batches.action(0);
  assert.equal(batches.groups[0],firstGroup);assert.equal(batches.sequence,initialSequence);assert.equal(batches.bindings.size,251);checks+=3;
}
for(const item of outcomeOnly)assert.equal(batches.bindings.get(item.id).group,firstGroup);checks+=251;
for(const clock of [0,100,266,400,566]){
  batches.update(outcomeOnly.map(item=>flight(item.id,clock/3800)),clock);
  for(const item of outcomeOnly){
    // Actor/held/tube phases must not even ask for a path object.
    const pose=batches.pose(flight(item.id,clock/3800),clock);
    assert.ok(!pose.visible||pose.phase==='held'||pose.phase==='mouth');checks++;
  }
}

// Arrivals just after each release produce at most a current and one future
// gesture. No per-ball animation queue grows behind a burst of arbitrary size.
const continuous=new PlinkoFilmBatches();let nextId=0,accepted=[];
for(let clock=0;clock<=16000;clock+=41){
  accepted=accepted.filter(item=>clock-item.started<3800);
  for(let i=0;i<7;i++)accepted.push({id:++nextId,started:clock});
  const publicFlights=accepted.map(item=>flight(item.id,(clock-item.started)/3800));
  continuous.update(publicFlights,clock);
  maxGroups=Math.max(maxGroups,continuous.groups.length);
  assert.ok(continuous.groups.length<=2,'Only current/next gestures can exist');checks++;
  assert.equal(continuous.bindings.size,publicFlights.length,'No admitted id is dropped');checks++;
  assert.ok(continuous.groups.filter(group=>group.start>clock).length<=1,'At most one future gesture');checks++;
  const current=continuous.action(clock);
  if(current){assert.ok(current.frame>=0&&current.frame<34&&Number.isInteger(current.frame));assert.ok(current.opacity>=0&&current.opacity<=1);checks+=2;}
  const before=continuous.sequence;continuous.update(publicFlights,clock);assert.equal(continuous.sequence,before,'Repeated render never schedules the same id twice');checks++;
}
continuous.update([],25000);assert.equal(continuous.bindings.size,0);assert.equal(continuous.groups.length,0);checks+=2;

// Every valid branch is projected onto the corresponding authored row, and
// the final row enters its own catch-tray anchor rather than a global Y scale.
for(const path of allPaths){
  for(let row=0;row<8;row++){
    const p=(row+1)/9,pose=plinkoFilmBoardPose(guardedPath(path,row+1),p);
    close(pose.x,960+path[row]*30.9,'Correct contact x');close(pose.y,459+row*48.2,'Correct contact y');
    for(const phase of [.02,.25,.5,.95]){
      const progress=(row+1+phase)/9,draw=plinkoFilmBoardPose(guardedPath(path,row+1),progress);
      assert.ok(Number.isFinite(draw.x)&&Number.isFinite(draw.y));checks++;
      const left=Math.min(path[row],path[row+1])*30.9+960,right=Math.max(path[row],path[row+1])*30.9+960;
      assert.ok(draw.x>=left-1e-8&&draw.x<=right+1e-8,'Each flight stays on its accepted branch');checks++;
    }
  }
  for(const p of [0,.01,.05,1/9-1e-9]){const pose=plinkoFilmBoardPose(guardedPath(path,-1),p);assert.equal(pose.row,-1);checks++;}
  const bin=(path[8]+8)/2,end=plinkoFilmBoardPose(guardedPath(path,8),1);
  close(end.x,960+(bin-4)*61.8,'Correct terminal bin x');close(end.y,864,'Correct terminal bin landing');
}

for(const [duration,reduced] of [[3800,false],[1900,false],[450,false],[450,true],[225,true]])for(const acceptedAt of [0,600,1125,1710]){
  const scheduler=new PlinkoFilmBatches();scheduler.update([flight(1,0)],0,duration,reduced);
  scheduler.update([flight(1,Math.min(.99,acceptedAt/duration)),flight(2,0)],acceptedAt,duration,reduced);
  const binding=scheduler.bindings.get(2);
  assert.ok(binding.fallback||binding.inlet<acceptedAt+duration,'Never hold a ball beyond its settlement deadline');checks++;
  if(reduced)assert.equal(scheduler.action(acceptedAt,true),null);checks++;
  for(let sample=0;sample<=100;sample++){
    const p=sample/100,clock=acceptedAt+p*duration,path=allPaths[63],pose=scheduler.pose(flight(2,p,path),clock,duration,reduced);
    if(pose.visible){assert.ok(Number.isFinite(pose.x)&&Number.isFinite(pose.y));checks++;}
    if(pose.phase==='board'){
      const maximum=Math.floor(pose.boardProgress*9),guard=guardedPath(path,maximum);
      const safe=scheduler.pose(flight(2,p,guard),clock,duration,reduced);
      close(safe.x,pose.x,'Film pose uses current visual prefix only');close(safe.y,pose.y,'Same projected current prefix');
      assert.ok(pose.boardProgress>=0&&pose.boardProgress<=1);checks++;
    }
    if(p===1){assert.equal(pose.visible,true);assert.equal(pose.phase,'board');close(pose.boardProgress,1,'Deadline reaches final bin');close(pose.y,864,'No settled ball remains held');checks+=2;}
  }
}

// Changing speed may shorten an already accepted flight. This must trigger
// nozzle fallback when needed, rather than changing its original settlement.
for(const changeAt of [100,600,1200,1800])for(const nextDuration of [1900,450,3800]){
  const scheduler=new PlinkoFilmBatches();scheduler.update([flight(4,0)],0,3800);
  scheduler.update([flight(4,changeAt/3800)],changeAt,3800);
  const p=Math.min(1,changeAt/nextDuration),path=allPaths[255],draw=scheduler.pose(flight(4,p,path),changeAt,nextDuration,nextDuration===450);
  assert.ok(!draw.visible||(Number.isFinite(draw.x)&&Number.isFinite(draw.y)));checks++;
  const final=scheduler.pose(flight(4,1,path),Math.max(changeAt,nextDuration),nextDuration,nextDuration===450);
  assert.equal(final.phase,'board');close(final.boardProgress,1,'Shortened deadline cannot stick in hand');close(final.x,1207.2,'Speed change retains accepted right-edge result');close(final.y,864,'Shortened round finishes at tray');checks++;
  const before=JSON.stringify(scheduler.action(changeAt)),again=JSON.stringify(scheduler.action(changeAt));assert.equal(again,before,'Paused controller time freezes atlas frame');checks++;
}

// The independently supplied mobile render is a calibrated camera conversion.
// Height fits completely; horizontal letterboxing keeps the dealer and trays
// visible on a short desktop instead of cropping them with object-fit:cover.
const sourceAnchors=[];
for(let row=0;row<8;row++)for(let column=0;column<=row;column++)sourceAnchors.push([960+(2*column-row)*30.9,459+row*48.2]);
for(let bin=0;bin<9;bin++)sourceAnchors.push([960+(bin-4)*61.8,864],[960+(bin-4)*61.8,937]);
sourceAnchors.push([680,0],[1240,400],[960,325],[960,449]);
for(const [width,height,mobile] of [[1920,1080,false],[1128,405,false],[960,600,false],[800,678,false],[720,960,true],[390,520,true],[300,400,true],[390,640,true]]){
  const projection=plinkoFilmProjection(width,height,mobile),source=mobile?{width:720,height:960}:film,scale=height/source.height;
  for(const [x,y] of sourceAnchors){
    const expectedX=(mobile?x*5/6-440:x)*scale+(width-source.width*scale)/2;
    const expectedY=(mobile?y*5/6+42:y)*scale,actual=projection.point(x,y);
    close(actual.x,expectedX,'Source-to-display x calibration');close(actual.y,expectedY,'Source-to-display y calibration');
  }
  assert.equal(projection.binAnchors.length,9);checks++;
  for(let bin=0;bin<9;bin++){
    const anchor=projection.binAnchors[bin],point=projection.point(960+(bin-4)*61.8,937);
    close(anchor.x,point.x,'Live HTML label and footage share x');close(anchor.y,point.y,'Live HTML label and footage share y');close(anchor.width,44*projection.factor,'Label width scales with footage');close(anchor.height,30*projection.factor,'Label height scales with footage');
    assert.ok(anchor.x-anchor.width/2>=0&&anchor.x+anchor.width/2<=width&&anchor.y-anchor.height/2>=0&&anchor.y+anchor.height/2<=height,'All nine complete labels stay on screen, including short desktop');checks++;
  }
  if(source.width*scale<=width+1e-8)for(const x of [film.actor.x,film.actor.x+film.actor.width])for(const y of [film.actor.y,film.actor.y+film.actor.height]){
    const point=projection.point(x,y);
    assert.ok(point.x>=-1e-8&&point.x<=width+1e-8&&point.y>=-1e-8&&point.y<=height+1e-8,'Whole actor patch/head stays inside a width-fitting native source');checks++;
  }
}

// Exercise the actual controller, including a broken presentation callback.
// Film rendering can neither re-charge a bet nor postpone an accepted credit.
let id=0,debits=0,credits=0,transient=false,last=null;const pending=new Map(),settled=new Set();
const session={begin(game,choice,stake){assert.equal(game,'plinko');debits++;const round={id:++id,stake,path:allPaths[id%256]};
  for(const key of ['bin','netCents'])Object.defineProperty(round,key,{get(){assert.ok(settled.has(round.id),'Outcome before complete');return key==='bin'?(round.path[8]+8)/2:-5;}});
  pending.set(round.id,round);return round;},complete(roundId){if(roundId===7&&!transient){transient=true;throw new Error('expected retry');}if(!pending.delete(roundId))return false;credits++;settled.add(roundId);last={id:roundId};return true;},getSnapshot(){return {result:last};}};
const originalError=console.error;console.error=()=>{};
try{
  const controller=new PlinkoFlightController(session,{requestFrame:()=>1,cancelFrame(){},onError(){}}),scheduler=new PlinkoFilmBatches();controller.attach();
  for(let i=0;i<251;i++)assert.ok(controller.launch(5));checks+=251;
  controller.setRenderer(()=>scheduler.update(controller.getPresentation(),controller.clockMs,controller.durationMs));
  for(let i=0;i<30;i++){controller.render();scheduler.action(controller.clockMs);}assert.equal(debits,251);assert.equal(credits,0);checks+=2;
  controller.advance(0);controller.advance(1000);
  controller.setRenderer(()=>{throw new TypeError('Malformed render-only media/path');});
  controller.advance(3800);assert.equal(credits,250);assert.equal(controller.activeCount,1);checks+=2;
  const kept=controller.getPresentation()[0],atBin=scheduler.pose(kept,controller.clockMs,controller.durationMs);assert.equal(atBin.phase,'board');close(atBin.boardProgress,1,'Retry remains at bin, not hand');checks++;
  controller.advance(3801);controller.detach();assert.equal(debits,251);assert.equal(credits,251);checks+=2;
}finally{console.error=originalError;}

for(const file of ['plinko-film-presentation.js','PlinkoVideoScene.jsx']){
  const code=(await readFile(new URL('../src/'+file,import.meta.url),'utf8')).replace(/\/\/[^\n]*/g,'');
  assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval|session\.|\.complete\(|\.begin\(|flight\.(stake|bin|won|payout|netCents)/.test(code),'Film must not own financial state, random draws, outcomes or another playback clock');checks++;
}
const motion=await readFile(new URL('../src/plinko-motion.js',import.meta.url));
assert.equal(createHash('sha256').update(motion).digest('hex'),'04ef20176b80384e5495828e767658bd8d8da88e73c731e7b8ae3ce3293f081b','Original physical path remains byte-identical');checks++;
console.log(JSON.stringify({passed:true,checks,paths:256,pegContacts:2048,burst:251,continuousAccepted:nextId,maxGroups,settled:credits,scope:'Outcome-blind whole-actor batching; no admission queue; short/speed deadlines; current visual prefix; 8 rows and 9 bins; mobile/source projection; render failure independent of exact-once settlement'}));
