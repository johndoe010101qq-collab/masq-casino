import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {ROULETTE_NUMBERS,rouletteColor} from '../src/game-math.js';
import {ROULETTE_FILM as film,rouletteFilmPose,rouletteFilmProject,rouletteFilmProjection,
  rouletteFilmNumbers,rouletteFilmView,rouletteFilmOverlayVisible,rouletteFilmRotor,rouletteFilmCamera,
  rouletteFilmRotorMesh,rouletteFilmTriangleTransform,rouletteFilmFrets,rouletteFilmRotorBounds,rouletteFilmHubMask,
  rouletteFilmRingPath} from '../src/roulette-film-presentation.js';
import {ROULETTE_FILM_CALIBRATION as calibration} from '../src/roulette-film-calibration.js';

let checks=0;
const check=(condition,message)=>{assert.ok(condition,message);checks++;};
const close=(a,b,message,tolerance=1e-7)=>check(Math.abs(a-b)<=tolerance,`${message}: ${a} / ${b}`);
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
const poison=()=>{throw new Error('Private Roulette outcome read before public gate');};
const secret={id:'accepted'};
for(const key of ['pocketIndex','number','color','won','payout','stake','net','label'])Object.defineProperty(secret,key,{get:poison});
const pose=(p,index=0)=>rouletteFilmPose({id:'accepted',pocketIndex:index},p,true);
const mod=a=>(a%(Math.PI*2)+Math.PI*2)%(Math.PI*2);
const derivative=(p,index=0,h=1e-7)=>{
  const a=pose(p-h,index),b=pose(p+h,index);
  return b.position.map((v,i)=>(v-a.position[i])/(2*h*film.roundSeconds));
};

for(let i=0;i<8200;i++){
  const p=film.reveal*i/8200,draw=rouletteFilmPose(secret,p,true);
  check(draw.position.every(Number.isFinite),'Every unrevealed trajectory position is finite');
  check(draw.pocketIndex===null&&!draw.reveal,'No private index is exposed before the gate');
  close(draw.mediaProgress,Math.min(1,p*6/(81/30)),'Media seeks canonical last-frame span');
}
for(const p of [undefined,NaN,Infinity,-Infinity,-1]){
  const draw=rouletteFilmPose(secret,p,true);close(draw.progress,0,'Malformed progress remains at start');
}
check(rouletteFilmPose(null,1,true).phase==='idle','No round stays idle');
check(!rouletteFilmPose(null,1,true).visible,'Idle has no extra ball over the stock ball');
check(!pose((36-1e-6)/180).visible,'The baked hand ball is not duplicated before frame36');
check(pose(36/180).visible,'App ball begins exactly at frame36');
const decoded={token:'accepted',src:'/classic-films-v47/roulette/desktop/release.mp4',released:true};
check(!rouletteFilmOverlayVisible(pose(.3),null,'accepted'),'Decoder not ready cannot duplicate baked ball');
check(!rouletteFilmOverlayVisible(pose(.3),{...decoded,released:false},'accepted'),'Decodedframe35 retains baked ball only');
check(rouletteFilmOverlayVisible(pose(.3),decoded,'accepted'),'Decodedframe36 hands off to the app ball');
check(rouletteFilmOverlayVisible(pose(.3),{...decoded,token:'42'},42),'Numeric Hall round id matches normalized media token');
check(!rouletteFilmOverlayVisible(pose(.3),decoded,'nextRound'),'Previous round buffer cannot release current overlay');
check(!rouletteFilmOverlayVisible(pose(.3),decoded,'accepted',true),'Old desktop buffer cannot release mobile overlay');
check(!rouletteFilmOverlayVisible(pose(.3),{...decoded,src:'/classic-films-v47/roulette/desktop/idle.mp4'},'accepted'),'Idle frame never hands off');
check(!rouletteFilmOverlayVisible(pose(.1),decoded,'accepted'),'Decoded stalefutureframe cannot bypass canonical release time');
check(rouletteFilmOverlayVisible(pose(1),null,'accepted'),'Skip/completion shows accepted endpoint without waiting for media');
close(distance(pose(.2).position,film.releasePosition),0,'Handoff uses physics.release.pos, not generic R.ball');
const releaseFuture=pose(.2+1e-8).position;
for(let axis=0;axis<3;axis++)close((releaseFuture[axis]-film.releasePosition[axis])/(6e-8),film.releaseVelocity[axis],
  'App handoff preserves the actual release velocity axis '+axis,8e-6);
close(pose(.45).mediaProgress,1,'Video freezes the final neutral frame after2.7s');
for(const p of [.451,.6,.82,.98,1])close(pose(p).mediaProgress,1,'Ball continues without restarting the finished gesture');
const entry=.2+film.entrySeconds/film.roundSeconds;
for(const boundary of [entry,film.reveal,film.landing]){
  for(let index=0;index<37;index++){
    const left=pose(boundary-1e-8,index),right=pose(boundary+1e-8,index);
    check(distance(left.position,right.position)<3e-5,'C0 continuous entry/reveal/landing');
    const dl=derivative(boundary-2e-8,index,1e-9),dr=derivative(boundary+2e-8,index,1e-9);
    check(distance(dl,dr)<.00015,'C1 continuous entry/reveal/landing, index '+index);
  }
}

for(let index=0;index<37;index++){
  let previousAngle=-Infinity;
  for(let step=36;step<=1800;step++){
    const p=step/1800,draw=pose(p,index);
    check(draw.position.every(Number.isFinite),'All37 accepted trajectories stay finite');
    check(draw.angle>=previousAngle-1e-10,'Ball never reverses the actual release direction');
    previousAngle=draw.angle;
    check(draw.radius>=film.pocketRadius-1e-8&&draw.radius<=film.trackRadius+1e-8,'Ball remains within physical wheel rings');
    check(draw.position[1]>=film.pocketY-1e-8&&draw.position[1]<=film.releasePosition[1]+1e-8,'Ball height remains inside track/pocket envelope');
    if(p<film.reveal)check(draw.radius>8,'No provisional accepted pocket is shown during the common rim run');
    for(const mobile of [false,true]){
      const point=rouletteFilmProject(draw.position,mobile),view=rouletteFilmView(mobile);
      check(point.x-point.radius>0&&point.x+point.radius<view.width&&point.y-point.radius>0&&point.y+point.radius<view.height,
        'Full accepted ball stays inside the native view');
    }
  }
  const landed=pose(1,index),normal=pose(film.landing,index);
  close(mod(landed.angle),index*Math.PI*2/37,'Accepted angle uses exact37-slot order',1e-10);
  close(landed.radius,5.25,'Accepted ball lies in source pocket ring');
  close(landed.position[1],14.92,'Accepted ball has exact source pocket height');
  close(distance(landed.position,normal.position),0,'Landed ball stays settled through financial completion');
  close(landed.pocketIndex,index,'No accepted index remapping');
  close(distance(rouletteFilmPose({pocketIndex:index},0,false).position,landed.position),0,'Stopped accepted round shows endpoint immediately');
  close(distance(rouletteFilmPose({pocketIndex:index},0,true,true).position,landed.position),0,'Reduced motion shows endpoint immediately');
}

// Exact independent source landmarks. Frame36 object.world is the empty cup,
// deliberately different from the real release origin below.
const reference=[
  {mobile:false,world:film.releasePosition,px:[785.616783,568.087739]},
  {mobile:true,world:film.releasePosition,px:[259.381225,580.417090]},
  {mobile:false,world:[0,16.19,13.6],px:[960,890.27]},
  {mobile:false,world:[0,14.92,9.85],px:[960,845.69]},
];
for(const mark of reference){const point=rouletteFilmProject(mark.world,mark.mobile);
  close(point.x,mark.px[0],'Exact source camera x',.006);close(point.y,mark.px[1],'Exact source camera y',.006);}
for(const mobile of [false,true]){
  const numbers=rouletteFilmNumbers(mobile),view=rouletteFilmView(mobile);
  check(numbers.length===37,'All37 blank-ring numerals are supplied');
  for(const number of numbers){
    close(number.number,ROULETTE_NUMBERS[number.index],'Numeral uses real accepted sector order');
    check(number.color===rouletteColor(number.number),'Baked source color and number agree');
    close(Math.hypot(number.position[0],number.position[2]-4.6),6.35,'Numeral stays inside physical number annulus');
    check(number.matrix.every(Number.isFinite),'Projected glyph axes remain finite');
    check(number.matrix[0]*number.matrix[3]-number.matrix[1]*number.matrix[2]>0,'Glyph axes preserve face orientation');
    check(number.x>0&&number.x<view.width&&number.y>0&&number.y<view.height,'Every number fits native camera');
  }
  check(view.rimFront.length===98,'Complete source near-rim occluder is retained');
}
for(const [width,height,mobile] of [[960,540,false],[1128,405,false],[390,520,true],[300,400,true],[720,960,true]]){
  const projected=rouletteFilmProjection(width,height,mobile),view=rouletteFilmView(mobile);
  close(projected.factor,height/view.height,'Height-fit camera has no vertical clipping');
  for(let index=0;index<37;index++){
    const point=projected.point(pose(1,index).position);
    check(point.x-point.radius>=0&&point.x+point.radius<=width&&point.y-point.radius>=0&&point.y+point.radius<=height,
      'Accepted ball stays fully inside desktop/mobile stage');
  }
}
for(let step=0;step<=980;step++){
  const p=step/1000,rotor=rouletteFilmRotor(p);
  check(rotor.angle<=1e-10&&rotor.velocity<=1e-10,'Whole rotor always turns opposite the free ball');
  if(step>0&&step<980){
    const h=1e-6,measured=(rouletteFilmRotor(p+h).angle-rouletteFilmRotor(p-h).angle)/(2*h*6);
    close(measured,rotor.velocity,'Rotor angular velocity is the actual projected motion',1e-6);
  }
  for(const mobile of [false,true]){
    const camera=rouletteFilmCamera(p,mobile),reduced=rouletteFilmCamera(p,mobile,true);
    check(camera.scale>=(mobile?1.55:1.10)&&camera.scale<=(mobile?1.851:1.341),'Public-progress zoom stays bounded');
    close(reduced.scale,mobile?1.55:1.10,'Reduced motion retains static closer framing without a camera move');
    const view=rouletteFilmView(mobile);
    const extrema=mobile?[[173,537],[547,830],[276,383],[446,490]]:[[636,493],[1285,990],[808,194],[1100,415]];
    for(const [px,py]of extrema){
      const x=camera.originX+(px-camera.originX)*camera.scale,y=camera.originY+(py-camera.originY)*camera.scale;
      check(x>=0&&x<=view.width&&y>=0&&y<=view.height,'Full original hood and bowl stay inside the closer native framing');
    }
    for(let index=0;index<37;index++){
      const point=rouletteFilmProject(pose(1,index).position,mobile);
      const x=camera.originX+(point.x-camera.originX)*camera.scale;
      const y=camera.originY+(point.y-camera.originY)*camera.scale,r=point.radius*camera.scale;
      check(x-r>=0&&x+r<=view.width&&y-r>=0&&y+r<=view.height,'Every accepted pocket remains framed during macro move');
    }
  }
}
close(rouletteFilmRotor(0).angle,0,'No initial rotor pop');
close(rouletteFilmRotor(0).velocity,0,'Rotor starts smoothly');
close(rouletteFilmRotor(.98).velocity,0,'Rotor stops smoothly by the original landing deadline');
close(rouletteFilmRotor(1).angle,-4*Math.PI,'Two complete turns preserve the real initial sector order');
for(const mobile of [false,true]){
  const view=rouletteFilmView(mobile),marks=mobile?
    [[0,171.7,586.8],[14,172.2,586.3],[27,294.1,559.2],[35,266.8,576.7],[36,259.381225,580.417090]]:
    [[0,633.6,579.1],[14,634.5,578.3],[27,845.8,531.4],[35,798.4,561.6],[36,785.616783,568.087739]];
  for(const [frame,px,py]of marks){
    const camera=rouletteFilmCamera(frame/180,mobile),radius=(mobile?9:15)*camera.scale;
    const x=camera.originX+(px-camera.originX)*camera.scale,y=camera.originY+(py-camera.originY)*camera.scale;
    check(x-radius>=0&&x+radius<=view.width&&y-radius>=0&&y+radius<=view.height,
      'Closer framing retains complete supplied pickup/carry/release ball at frame '+frame);
  }
}
for(const mobile of [false,true])for(const progress of [0,.073,.2,.47,.69,.82,.91,.98,1]){
  const angle=rouletteFilmRotor(progress).angle,bounds=rouletteFilmRotorBounds(mobile);
  const mesh=rouletteFilmRotorMesh(angle,mobile);
  check(mesh.length===888,'Full three-level rotor is rasterized, rather than digits over static colours');
  for(const triangle of mesh){
    const matrix=rouletteFilmTriangleTransform(triangle.source,triangle.target);
    check(matrix&&matrix.every(Number.isFinite),'Every raster triangle has a valid affine camera transform');
    for(let i=0;i<3;i++){
      const [x,y]=triangle.source[i],[u,v]=triangle.target[i];
      check(x>=0&&x<=672&&y>=0&&y<=672,'Raster UV stays inside supplied topdown material');
      close(matrix[0]*x+matrix[2]*y+matrix[4],u,'Raster x lands exactly on projected physical rotor',2e-9);
      close(matrix[1]*x+matrix[3]*y+matrix[5],v,'Raster y lands exactly on projected physical rotor',2e-9);
      check(u>=bounds.x&&u<=bounds.x+bounds.width&&v>=bounds.y&&v<=bounds.y+bounds.height,'No raster triangle clips at its canvas edge');
    }
  }
  const numbers=rouletteFilmNumbers(mobile,angle),frets=rouletteFilmFrets(angle,mobile);
  check(frets.length===111,'Every physical separator has a top and two visible side walls');
  for(const number of numbers){
    const expected=number.index*Math.PI*2/37+angle;
    close(number.position[0],Math.sin(expected)*6.35,'Number and colour share one rotor x transform');
    close(number.position[2],4.6+Math.cos(expected)*6.35,'Number and colour share one rotor z transform');
  }
  for(const face of frets)for(const [x,y]of face.points)
    check(x>=bounds.x&&x<=bounds.x+bounds.width&&y>=bounds.y&&y<=bounds.y+bounds.height,'Raised frets remain fully in the same camera patch');
  check(rouletteFilmHubMask(mobile).length===7,'Original fixed spindle is restored above moving rotor');
  check(!/NaN|Infinity/.test(rouletteFilmRingPath(4.62,5.86,14.53,angle,mobile,0,.1)),'Accepted sector mask is finite at all rotations');
}
check(rouletteFilmTriangleTransform([[0,0],[1,1],[2,2]],[[0,0],[1,1],[2,2]])===null,'Degenerate raster triangle cannot poison the canvas transform');
const json=JSON.parse(await readFile(new URL('../public/classic-films-v47/roulette/layout-calibration.json',import.meta.url),'utf8'));
assert.deepEqual(json,calibration);checks++;

// MP4 tables are inspected without launching any uploaded source or relying on
// a machine-specific ffprobe installation. stsz contains the encoded sample
// count; avc1 contains the coded source dimensions.
for(const view of ['desktop','mobile']){
  const dimensions=view==='desktop'?[1920,1080]:[720,960];
  for(const clip of ['idle','release']){
    const file=await readFile(new URL('../public/classic-films-v47/roulette/'+view+'/'+clip+'.mp4',import.meta.url));
    const stsz=file.indexOf(Buffer.from('stsz'));
    check(stsz>0,'Optimized clip has a sample-size table');
    close(file.readUInt32BE(stsz+12),clip==='idle'?270:82,'Optimized clip retains every supplied frame');
    const stsd=file.indexOf(Buffer.from('stsd'));
    const avc1=file.indexOf(Buffer.from('avc1'),stsd+4);
    check(avc1>=0,'Optimized clip uses H264/AVC');
    close(file.readUInt16BE(avc1+28),dimensions[0],'Video coded width preserves calibration');
    close(file.readUInt16BE(avc1+30),dimensions[1],'Video coded height preserves calibration');
    check(file.indexOf(Buffer.from('moov'))<file.indexOf(Buffer.from('mdat')),'Fast-start header precedes video data');
  }
  const poster=await readFile(new URL('../public/classic-films-v47/roulette/'+view+'/poster.webp',import.meta.url));
  check(poster.subarray(0,4).toString()==='RIFF'&&poster.subarray(8,12).toString()==='WEBP','Native poster is a real WebP');
}
const source=await readFile(new URL('../src/roulette-film-presentation.js',import.meta.url),'utf8');
const jsx=await readFile(new URL('../src/RouletteFilm.jsx',import.meta.url),'utf8');
check(!/Math\.random|requestAnimationFrame|setTimeout|session\.(begin|complete)|Date\.now/.test(source+jsx),
  'Film introduces no RNG, independent clock or settlement path');
check(jsx.includes('pose.mediaProgress')&&jsx.includes('rouletteFilmOverlayVisible'),'Component uses the tested media handoff and disclosure gates');
check(jsx.includes('pointerEvents:\'none\''),'Overlay cannot intercept betting controls');
check(jsx.includes('view.rimFront')&&jsx.includes('mask={'),'Ball is composited behind the actual foreground rim');
check(jsx.includes('rouletteFilmOverlayVisible(pose,decoded'),'Actual renderer uses the tested decoded-frame handoff');
check(jsx.includes('rouletteFilmRotorMesh(angle,mobile)')&&jsx.includes('rouletteFilmFrets(angle,mobile)'),
  'Actual raster canvas renders the tested coloured mesh and raised separators');
check(jsx.includes('rouletteFilmNumbers(mobile,pose.rotorAngle)'),'Actual numerals rotate with the physical pockets');
check(jsx.includes("const settled=pose.phase==='settled'")&&jsx.includes('{settled&&<div'),
  'Result number and pocket accent appear only after actual landing');
const css=await readFile(new URL('../src/RouletteFilm.css',import.meta.url),'utf8');
check(css.includes('prefers-reduced-motion:reduce'),'Result entrance respects reduced motion');
const {createServer}=await import('vite');
const server=await createServer({root:new URL('..',import.meta.url).pathname.replace(/^\/(\w:)/,'$1'),server:{middlewareMode:true},appType:'custom',logLevel:'silent'});
try{
  const actual=await server.ssrLoadModule('/src/RouletteFilm.jsx');
  check(typeof actual.default==='function','Actual JSX module and shared media stage compile together');
}finally{await server.close();}
console.log(`PASS roulette film: ${checks} checks;37 accepted sectors, exact release/C1 gates, original cameras,4 MP4 and2 posters`);
