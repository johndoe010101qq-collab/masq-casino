// Copy to indictus-site/tests unchanged. Reads live source and writes no Site files.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const local=new URL('../src/UpgraderHacker.jsx',import.meta.url);
const site=existsSync(local)?new URL('../',import.meta.url):new URL('../../indictus-site/',import.meta.url);
const {upgradeTerminalPose,terminalCode}=await import(new URL('src/upgrader-presentation.js',site));
const {HallSession}=await import(new URL('src/hall-session.js',site));
const {default:GameMath}=await import(new URL('src/game-math.js',site));
const {createRoundPlayback}=await import(new URL('src/RoundPlayback.js',site));
const {default:React}=await import(new URL('node_modules/react/index.js',site));
const {renderToStaticMarkup}=await import(new URL('node_modules/react-dom/server.node.js',site));
const {createServer}=await import(new URL('node_modules/vite/dist/node/index.js',site));
let checks=0;const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);},ok=(value,message)=>{checks++;assert(value,message);};
const loader=await createServer({root:fileURLToPath(site),configFile:false,server:{middlewareMode:true,hmr:false,ws:false},appType:'custom'});
const {default:UpgraderHacker}=await loader.ssrLoadModule('/src/UpgraderHacker.jsx');
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

// The live Minecraft monitor replaces the obsolete raster cabinet. SSR proves
// its public outcome text; material/3D layout is verified in a real browser.
const idle=html({round:null,progress:0,playing:false});
ok(idle.includes('data-minecraft-game="upgrader"'),'Live shared studio mounted');
ok(!idle.includes('<svg')&&!idle.includes('atlas')&&!idle.includes('<img'),'No vector, painted cabinet, or sprite crop');

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
await loader.close();
console.log(JSON.stringify({passed:true,checks,clockPaths,scope:'Live Minecraft terminal SSR pre-reveal equivalence, bounded display data, and paid Hall clock lifecycle with skip/reduced/hidden/unmount/idempotent credit; 3D appearance checked separately'}));
