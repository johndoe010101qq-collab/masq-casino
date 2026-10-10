// Copy to indictus-site/tests unchanged. Reads live source and writes no Site files.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
const local=new URL('../src/UpgraderHacker.jsx',import.meta.url);
const site=existsSync(local)?new URL('../',import.meta.url):new URL('../../indictus-site/',import.meta.url);
const {upgradeTerminalPose,terminalCode}=await import(new URL('src/upgrader-presentation.js',site));
const {HallSession}=await import(new URL('src/hall-session.js',site));
const {default:GameMath}=await import(new URL('src/game-math.js',site));
const {createRoundPlayback}=await import(new URL('src/RoundPlayback.js',site));
const {default:React}=await import(new URL('node_modules/react/index.js',site));
const {renderToStaticMarkup}=await import(new URL('node_modules/react-dom/server.node.js',site));
const {transformWithOxc}=await import(new URL('node_modules/vite/dist/node/index.js',site));
const {default:postcss}=await import(new URL('node_modules/postcss/lib/postcss.mjs',site));
let checks=0;const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);},ok=(value,message)=>{checks++;assert(value,message);};
const source=readFileSync(new URL('src/UpgraderHacker.jsx',site),'utf8')
 .replace(/import ['"]\.\/[^'"\n]+\.css['"];?\n/g,'')
 .replace(/from ['"]react['"]/g,'from '+JSON.stringify(new URL('node_modules/react/index.js',site).href))
 .replace(/from ['"]\.\/upgrader-presentation\.js['"]/g,'from '+JSON.stringify(new URL('src/upgrader-presentation.js',site).href))
 .replaceAll('import.meta.env.BASE_URL',JSON.stringify('/'));
const transformed=await transformWithOxc(source,'UpgraderHacker.jsx',{jsx:{runtime:'classic'}});
const {default:UpgraderHacker}=await import('data:text/javascript;base64,'+Buffer.from(transformed.code).toString('base64'));
const html=props=>renderToStaticMarkup(React.createElement(UpgraderHacker,props));

// The actual rendered DOM, including status/class/styles, is identical for
// winning and losing tickets throughout the unrevealed sequence.
for(const target of [1.5,2,4,8])for(let tick=0;tick<920;tick+=4){
 const progress=tick/1000,base={progress,playing:true,targetChoice:target};
 const win=html({...base,round:{targetMultiplier:target,won:true}}),loss=html({...base,round:{targetMultiplier:target,won:false}});
 eq(win,loss,'No ticket information appears before reveal');
 const poison={targetMultiplier:target,get won(){throw new Error('Premature outcome read');}};
 eq(html({...base,round:poison}),win,'Render must not read outcome before reveal');
 ok(!win.includes('ACCESS GRANTED')&&!win.includes('ACCESS DENIED'),'No early access outcome');
 ok(win.includes('outcome-pending'),'Pending class stays neutral');
}
for(let tick=0;tick<=1000;tick++){
 const p=tick/1000,pose=upgradeTerminalPose(p);
 ok(Object.isFrozen(pose),'Pose immutable');eq(pose.reveal,p>=.92,'Reveal boundary');
 ok(Number.isInteger(pose.packets)&&pose.packets>=0&&pose.packets<=12,'Packet count bounded');
 ok(Number.isInteger(pose.codeTick)&&pose.codeTick>=0&&pose.codeTick<=52,'Code tick bounded');
 ok(pose.scanY>=0&&pose.scanY<=1400+1e-9,'Scan travel bounded');
 ok(/^[0-9A-F]{4}  [0-9A-F]{4}  [0-9A-F]{4}$/.test(terminalCode(pose.codeTick)),'Synthetic code is valid display data');
}
for(const value of [NaN,Infinity,-Infinity,undefined,-1])eq(upgradeTerminalPose(value).reveal,false,'Invalid progress cannot expose outcome');
eq(upgradeTerminalPose(1,false).phase,'idle');eq(upgradeTerminalPose(1,false).reveal,false);eq(terminalCode(0,false),'••••  ••••  ••••');
for(const [won,phrase] of [[true,'ACCESS GRANTED'],[false,'ACCESS DENIED']]){
 const round={targetMultiplier:4,won};
 ok(html({round,progress:.92,playing:true}).includes(phrase),'Outcome appears at reveal boundary');
 ok(html({round,progress:0,playing:false}).includes(phrase),'Stopped settled round shows final pose');
 ok(html({round,progress:0,playing:true,reduced:true}).includes(phrase),'Reduced motion presents final pose');
}
ok(html({round:null,progress:1,playing:true,reduced:true}).includes('Готов к взлому'),'No round stays idle');

// Raster placement: the transparent mask uses a complete PNG, not an atlas
// crop, and the overlay fits the blank monitor area of the 3:2 scene.
const png=readFileSync(new URL('public/upgrader-hacker-terminal.png',site));
eq(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
eq(png.readUInt32BE(16)/png.readUInt32BE(20),1.5,'Scene matches workstation aspect ratio');
ok(existsSync(new URL('public/anonymous-mask-minimal.png',site)),'Complete identity PNG exists');
const idle=html({round:null,progress:0,playing:false});
ok(idle.includes('/upgrader-hacker-terminal.png')&&idle.includes('/anonymous-mask-minimal.png'),'Correct raster assets rendered');
ok(!idle.includes('<svg')&&!idle.includes('atlas'),'No vector or sprite crop');
const css=postcss.parse(readFileSync(new URL('src/UpgraderHacker.css',site),'utf8'));
const screen=css.nodes.find(node=>node.type==='rule'&&node.selector==='.hacker-screen');
const declarations=Object.fromEntries(screen.nodes.filter(n=>n.type==='decl').map(n=>[n.prop,n.value]));
const percent=property=>parseFloat(declarations[property])/100;
ok(percent('left')>=.18&&1-percent('right')<=.82,'Overlay stays within monitor horizontally');
ok(percent('top')>=.10&&percent('top')+percent('height')<=.62,'Overlay stays within monitor vertically');

// Clock paths use the actual Hall ledger. Skip, reduced motion, hidden tabs,
// unmount and late frames must not draw a new ticket or duplicate the credit.
let clockPaths=0;
for(const target of [1.5,2,4,8])for(const stake of [5,250])for(const winning of [true,false])for(const mode of ['natural','skip','reduced','hidden','unmount']){
 let draws=0,hidden=false,serial=0,progress=0,settlements=0,shown=0;
 const pending=new Map(),config=GameMath.rules('upgrader',target);
 const session=new HallSession(GameMath,maximum=>{draws++;eq(maximum,config.sampleSize);return winning?0:maximum-1;});
 const before=session.getSnapshot().balance,bankBefore=session.getReserveSnapshot().bankCents;
 const round=session.begin('upgrader',target,stake);eq(draws,1);
 const play=createRoundPlayback({duration:3200,requestFrame:callback=>{pending.set(++serial,callback);return serial;},cancelFrame:id=>pending.delete(id),isHidden:()=>hidden,onProgress:value=>{progress=value;},onComplete:show=>{settlements++;eq(session.complete(round.id),true);if(show)shown++;}});
 const frame=now=>{const callbacks=[...pending.values()];pending.clear();for(const callback of callbacks)callback(now);};
 let clockNow=0;
 const advanceTo=target=>{while(clockNow+100<target){clockNow+=100;frame(clockNow);}clockNow=target;frame(target);};
 if(mode==='reduced')eq(play.finish(),true);
 else{
  play.start();frame(0);advanceTo(960);
  if(mode==='hidden'){
   const paused=progress;hidden=true;play.visibilityChanged();frame(60000);eq(progress,paused);eq(settlements,0);
   hidden=false;play.visibilityChanged();frame(60000);clockNow=60000;eq(progress,paused);advanceTo(61000);advanceTo(62240);
  }else if(mode==='skip')eq(play.finish(),true);
  else if(mode==='unmount')eq(play.finish(false),true);
  else {advanceTo(2930);eq(upgradeTerminalPose(progress).reveal,false);advanceTo(2944);eq(upgradeTerminalPose(progress).reveal,true);advanceTo(3200);}
 }
 eq(settlements,1);eq(shown,mode==='unmount'?0:1);eq(play.finish(),false);frame(999999);eq(settlements,1);eq(session.complete(round.id),false);eq(draws,1);
 eq(session.getSnapshot().balance,before-stake+round.payout,'Exact one-time player credit');
 eq(session.getReserveSnapshot().bankCents,bankBefore+round.chargeCents-round.payoutCents,'Exact one-time bank debit');
 eq(session.getSnapshot().activeCount,0);clockPaths++;
}
console.log(JSON.stringify({passed:true,checks,clockPaths,scope:'Live terminal SSR pre-reveal equivalence, bounded display data/PNG placement, and paid Hall clock lifecycle with skip/reduced/hidden/unmount/idempotent credit'}));
