import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PLINKO_FILM,plinkoFilmProjection,plinkoFilmBoardPose,PlinkoFilmBatches} from '../src/plinko-film-presentation.js';
import {PLINKO_FILM_VIEWS} from '../src/plinko-film-metadata-v47.js';
import {PlinkoFlightController} from '../src/plinko-controller.js';
let checks=0,minimumClearance=Infinity,maxGroups=0;
const close=(a,b,message,tolerance=.000001)=>{assert.ok(Math.abs(a-b)<=tolerance,`${message}: ${a} != ${b}`);checks++;};
const poison=()=>{throw new Error('Read private or future outcome');};
const paths=Array.from({length:256},(_,n)=>{const p=[0];for(let r=0;r<8;r++)p.push(p.at(-1)+((n>>r)&1?1:-1));return p;});
const guard=(p,max)=>new Proxy(p,{get(t,k){if(typeof k==='string'&&/^\d+$/.test(k)){assert.ok(+k<=max,'Future branch read');checks++;return t[k];}return poison();}});
const flight=(id,progress,path)=>{const f={id,progress};for(const k of ['stake','bin','won','payout','netCents'])Object.defineProperty(f,k,{get:poison});if(path)f.path=path;else Object.defineProperty(f,'path',{get:poison});return f;};
const directory=new URL('../public/plinko-dealer-v47/',import.meta.url);
for(const key of ['desktop','mobile']){
 const view=PLINKO_FILM_VIEWS[key],mobile=key==='mobile';
 const source=JSON.parse(await readFile(new URL(`source-metadata/${key}-layout.json`,directory)));
 assert.deepEqual(view.pegs,source.plinko.pegs);assert.deepEqual(view.labels,source.plinko.tray_label_plates);assert.deepEqual(view.landing,source.plinko.landing_points);checks+=3;
 for(const [clip,data] of Object.entries(view.clips)){
  const marks=JSON.parse(await readFile(new URL(`source-metadata/${key}-${clip}.json`,directory)));
  assert.equal(data.track.length,34);checks++;
  for(let f=0;f<34;f++)for(const hand of ['R','L']){assert.deepEqual(data.track[f][hand],marks.per_frame[f][hand].ball);checks++;}
  for(const [name,frame] of [['pickup',8],['ball_visible',12],['release',17],['handoff',19],['neutral',33]]){assert.equal(data.marks.find(mark=>mark.name===name).frame,frame);checks++;}
  assert.ok((await stat(new URL(`${clip.replaceAll('_','-')}-${key}-atlas.webp`,directory))).size>100000);checks++;
 }
 for(const [a,b] of [['drop_left','drop_right_after_left'],['drop_right','drop_left_after_right'],['drop_left_after_right','drop_right_after_left'],['drop_right_after_left','drop_left_after_right']])for(const hand of ['R','L']){
  assert.deepEqual(view.clips[a].track[19][hand],view.clips[b].track[0][hand]);checks++;
 }
 for(const [width,height] of (mobile?[[720,960],[390,520],[300,400]]:[[1920,1080],[1128,405],[960,600],[800,678]])){
  const projection=plinkoFilmProjection(width,height,mobile),scale=height/view.frame.height;
  for(let bin=0;bin<9;bin++){
   const l=view.labels[bin],anchor=projection.binAnchors[bin],point=projection.nativePoint(l.x+l.w/2,l.y+l.h/2);
   close(anchor.x,point.x,'Native label x');close(anchor.y,point.y,'Native label y');close(anchor.width,l.w*scale,'Native label width');close(anchor.height,l.h*scale,'Native label height');
   assert.ok(anchor.x>=0&&anchor.x<=width&&anchor.y>=0&&anchor.y<=height,'Label remains visible');checks++;
  }
 }
 for(const path of paths){
  for(let row=0;row<8;row++){
   const peg=view.pegs[row*(row+1)/2+(path[row]+row)/2],p=plinkoFilmBoardPose(guard(path,row+1),(row+1)/9,mobile);
   close(p.x,peg.x,'Authored peg x');close(p.y,peg.y-view.ballRadius-view.pegRadius,'Full-radius top contact');
  }
  for(let tick=0;tick<=1800;tick++){
   const progress=tick/1800,max=Math.floor(progress*9),p=plinkoFilmBoardPose(guard(path,max),progress,mobile);
   assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));checks++;
   for(const peg of view.pegs){
    const dx=Math.max(0,Math.abs(p.x-peg.x)-view.pegRadius),dy=Math.max(0,Math.abs(p.y-peg.y)-view.pegRadius);
    const clearance=Math.hypot(dx,dy)-view.ballRadius;
    minimumClearance=Math.min(clearance,minimumClearance);
    assert.ok(clearance>=-.021,`Pin penetration ${key}: ${clearance}, at ${progress}, row ${peg.row}`);checks++;
   }
  }
  const end=plinkoFilmBoardPose(guard(path,8),1,mobile),landing=view.landing[(path[8]+8)/2];
  close(end.x,landing.x,'Exact landing x');close(end.y,landing.y,'Exact landing y');
 }
 const scheduler=new PlinkoFilmBatches();scheduler.update([flight(1,0)],0);
 for(const frame of [0,8,11,12,13.5,15,17]){
  const clock=frame/30*1000,p=scheduler.pose(flight(1,clock/3800),clock,3800,false,mobile);
  if(frame<12){assert.equal(p.visible,false);checks++;continue;}
  const i=Math.floor(frame),u=frame-i,a=view.clips.drop_left.track[i].R,b=view.clips.drop_left.track[Math.min(33,i+1)].R;
  close(p.x,a[0]+(b[0]-a[0])*u,'Exact tracked hand x');close(p.y,a[1]+(b[1]-a[1])*u,'Exact tracked hand y');assert.equal(p.phase,'held');checks++;
 }
}

// A rapid accepted burst shares a whole actor, never an admission queue.
const scheduler=new PlinkoFilmBatches(),burst=Array.from({length:251},(_,i)=>flight(i+1,0));
scheduler.update(burst,0);assert.equal(scheduler.bindings.size,251);assert.equal(scheduler.groups.length,1);checks+=2;
for(let n=0;n<20;n++)scheduler.update(burst,0);assert.equal(scheduler.sequence,1);checks++;
const second=flight(252,0),at=590;
scheduler.update([...burst.map(f=>flight(f.id,at/3800)),second],at);
close(scheduler.groups[0].end,PLINKO_FILM.handoffMs,'Prior group ends at authored handoff');
assert.equal(scheduler.groups[1].clip,'drop_right_after_left');assert.equal(scheduler.action(PLINKO_FILM.handoffMs).clip,'drop_right_after_left');checks+=2;
assert.equal(scheduler.action(PLINKO_FILM.handoffMs).frame,0);checks++;

const continuous=new PlinkoFilmBatches();let next=0,active=[];
for(let clock=0;clock<20000;clock+=41){
 active=active.filter(f=>clock-f.at<3800);for(let n=0;n<7;n++)active.push({id:++next,at:clock});
 continuous.update(active.map(f=>flight(f.id,(clock-f.at)/3800)),clock);
 maxGroups=Math.max(maxGroups,continuous.groups.length);assert.ok(continuous.groups.length<=2);assert.equal(continuous.bindings.size,active.length);checks+=2;
 const action=continuous.action(clock);if(action){assert.ok(action.frame>=0&&action.frame<=33);checks++;}
}
continuous.update([],30000);assert.equal(continuous.groups.length,0);assert.equal(continuous.bindings.size,0);checks+=2;

// Loading or reduced-motion gestures must not appear belatedly mid-flight.
const loading=new PlinkoFilmBatches();loading.update([flight(1,0)],0,3800,true);assert.equal(loading.action(400),null);checks++;
loading.update([flight(1,.2),flight(2,0)],760,3800,false);assert.equal(loading.action(760).frame,0);assert.equal(loading.bindings.get(1).fallback,true);checks+=2;

for(const duration of [3800,1900,450,225])for(const reduced of [false,true])for(const at of [0,590,1150,1800]){
 const s=new PlinkoFilmBatches();s.update([flight(1,0)],0,duration,reduced);s.update([flight(1,Math.min(.99,at/duration)),flight(2,0)],at,duration,reduced);
 for(let tick=0;tick<=100;tick++){
  const progress=tick/100,clock=at+progress*duration,p=s.pose(flight(2,progress,paths[91]),clock,duration,reduced);
  if(p.visible){assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.y));checks++;}
  if(progress===1){assert.equal(p.phase,'board');close(p.boardProgress,1,'Deadline reaches board end');close(p.x,PLINKO_FILM_VIEWS.desktop.landing[(paths[91][8]+8)/2].x,'Accepted final bin');checks++;}
 }
}

let id=0,debits=0,credits=0;const pending=new Map();
const session={begin(){const round={id:++id,stake:5,path:paths[id%256],bin:(paths[id%256][8]+8)/2,netCents:0};debits++;pending.set(round.id,round);return round;},complete(i){if(!pending.delete(i))return false;credits++;return true;},getSnapshot(){return {result:null};}};
const controller=new PlinkoFlightController(session,{requestFrame:()=>1,cancelFrame(){}});controller.attach();
for(let i=0;i<251;i++)controller.launch(5);
controller.setRenderer(()=>{const f=controller.getPresentation();scheduler.update(f,controller.clockMs,controller.durationMs);for(const item of f)scheduler.pose(item,controller.clockMs,controller.durationMs);});
controller.advance(0);controller.advance(3800);controller.detach();assert.equal(debits,251);assert.equal(credits,251);checks+=2;
for(const file of ['plinko-film-presentation.js','PlinkoVideoScene.jsx']){
 const code=(await readFile(new URL('../src/'+file,import.meta.url),'utf8')).replace(/\/\/[^\n]*/g,'');
 assert.ok(!/Math\.random|Date\.now|performance\.now|requestAnimationFrame|setTimeout|setInterval|session\.|\.complete\(|\.begin\(|flight\.(stake|bin|won|payout|netCents)/.test(code),'Presentation cannot own money, random draws or a second action clock');checks++;
}
assert.equal(createHash('sha256').update(await readFile(new URL('../src/plinko-motion.js',import.meta.url))).digest('hex'),'04ef20176b80384e5495828e767658bd8d8da88e73c731e7b8ae3ce3293f081b');checks++;
console.log(JSON.stringify({passed:true,checks,minimumClearance,maxGroups,concurrent:251,settled:credits,paths:256,views:2,source:'Exact supplied metadata; actor handoff19; full-radius caps; deadline fallback; unchanged money controller'}));
