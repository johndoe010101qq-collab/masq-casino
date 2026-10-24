// Copy to indictus-site/tests unchanged. Reads live source, edits no Site files.
import assert from 'node:assert/strict';
import {existsSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const local=new URL('../src/mask-slot-presentation.js',import.meta.url);
const site=existsSync(local)?new URL('../',import.meta.url):new URL('../../indictus-site/',import.meta.url);
const files=['src/mask-slot-presentation.js','src/MaskSlotRoom.jsx','src/MaskSlotRoom.css','src/mask-slots.js','src/hall-session.js','src/RoundPlayback.js'];
const source=Object.fromEntries(files.map(name=>[name,readFileSync(new URL(name,site),'utf8')]));
const hash=text=>createHash('sha256').update(text).digest('hex'),sourceSHA256=Object.fromEntries(files.map(name=>[name,hash(source[name])]));
const load=text=>import('data:text/javascript;base64,'+Buffer.from(text).toString('base64'));
const {maskSlotSteps,maskCascadeCells,maskSlotStepAudio,maskCollectionPayouts}=await load(source['src/mask-slot-presentation.js']);
const {playMaskSlot,playMaskSpin,evaluateMaskHouseLines,MASK_SLOT_RULES:rules,MASK_REGULAR_KINDS:kinds}=await load(source['src/mask-slots.js']);
const {HallSession}=await import(new URL('src/hall-session.js',site));
const {createRoundPlayback}=await import(new URL('src/RoundPlayback.js',site));
const {SLOT_THEMES}=await import(new URL('src/slot-themes.js',site));
const {default:React}=await import(new URL('node_modules/react/index.js',site));
const {renderToStaticMarkup}=await import(new URL('node_modules/react-dom/server.node.js',site));
const {transformWithOxc}=await import(new URL('node_modules/vite/dist/node/index.js',site));
const {default:postcss}=await import(new URL('node_modules/postcss/lib/postcss.mjs',site));
let checks=0;const eq=(a,b,message)=>{checks++;assert.deepEqual(a,b,message);},ok=(x,message)=>{checks++;assert(x,message);};
function rng(seed){let state=seed>>>0;return max=>{const cutoff=Math.floor(4294967296/max)*max;let x;do{state=(state+0x6d2b79f5)>>>0;x=state;x=Math.imul(x^(x>>>15),x|1);x^=x+Math.imul(x^(x>>>7),x|61);x=(x^(x>>>14))>>>0;}while(x>=cutoff);return x%max;};}
const board=(columns,rows)=>Array.from({length:columns},(_,c)=>Array.from({length:rows},(_,r)=>({id:'fixture:'+c+':'+r,kind:kinds[(c+r*2)%9]})));
// Exercise the actual pure Board and Symbol renderer, retaining React keys.
const roomSource=source['src/MaskSlotRoom.jsx'],start=roomSource.indexOf('function Symbol('),end=roomSource.indexOf('function Purchase(');
ok(start>=0&&end>start);
const boardModule=`import {CURRENCY,currencyText} from ${JSON.stringify(new URL('src/currency.js',site).href)};import React from ${JSON.stringify(new URL('node_modules/react/index.js',site).href)};const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);\n${roomSource.slice(start,end)}\nexport default Board;`;
const {default:Board}=await load((await transformWithOxc(boardModule,'MaskSlotBoard.jsx',{jsx:{runtime:'classic'}})).code);
const atlas={url:'/fixture.png',indices:Object.fromEntries([...kinds,'wild','scatter','bomb'].map((kind,i)=>[kind,i]))};
const children=node=>{const values=node?.props?.children;return(Array.isArray(values)?values:[values]).flat(Infinity).filter(value=>value!==null&&value!==undefined&&value!==false);};
const hasClass=(node,name)=>node?.props?.className?.split(' ').includes(name);
const descendants=node=>[node,...children(node).flatMap(child=>typeof child==='object'?descendants(child):[])];
const render=(visual,game='lecipher')=>Board({visual,atlas,config:rules[game],idle:visual.previous||visual.grid,names:SLOT_THEMES[game].names});
const propsFor=(grid,extra={})=>({phase:'cascade',grid,previous:grid,wins:[],goldenCells:[],freeSpin:false,serial:1,...extra});

// Concrete gravity: remove rows1/3, preserving the row4 anchor exactly.
const before=board(6,5),after=before.map(column=>[...column]);
after[0]=[{id:'refill:0:0',kind:'flag'},{id:'refill:0:1',kind:'key'},before[0][0],before[0][2],before[0][4]];
const motion=maskCascadeCells(before,after),byId=new Map(motion.map(cell=>[cell.id,cell]));
eq(motion.length,30);eq(byId.get(before[0][4].id),{id:before[0][4].id,column:0,row:4,fromRow:4,offsetRows:0,moving:false});
eq(byId.get(before[0][0].id).offsetRows,-2);eq(byId.get(before[0][2].id).offsetRows,-1);
eq(byId.get('refill:0:0').offsetRows,-2);eq(byId.get('refill:0:1').offsetRows,-2);
const visual=propsFor(after,{previous:before,cascadeCells:motion,goldenCells:[{column:0,row:1},{column:1,row:4}]}),tree=render(visual),all=descendants(tree);
const strips=all.filter(node=>hasClass(node,'mask-reel-strip')),cellNodes=all.filter(node=>hasClass(node,'mask-slot-cell'));
eq(strips.length,6);eq(cellNodes.length,30);ok(strips.every(node=>!hasClass(node,'is-reeling')),'Cascade never adds a whole reel strip.');
eq(cellNodes.filter(node=>hasClass(node,'mask-cascade-drop')).length,4,'Only two refills/two survivors move.');
for(const node of cellNodes){const raw=String(node.key).split('$').at(-1),descriptor=byId.get(raw);if(descriptor)eq(hasClass(node,'mask-cascade-drop'),descriptor.moving);}
const stationaryNode=cellNodes.find(node=>String(node.key).includes(before[0][4].id));ok(stationaryNode);eq(stationaryNode.props.style['--drop-y'],'0%');ok(!hasClass(stationaryNode,'mask-cascade-drop'));
const gold=children(tree).find(node=>hasClass(node,'mask-golden-grid'));ok(gold);eq(children(gold).map(node=>node.props.style),[{gridColumn:1,gridRow:2},{gridColumn:2,gridRow:5}]);
for(const strip of strips)ok(!descendants(strip).some(node=>hasClass(node,'mask-golden-cell')),'Gold is outside moving reel strips.');
const later=render({...visual,serial:2,phase:'summary',wins:[]});eq(children(later).find(node=>hasClass(node,'mask-golden-grid')).props.children.map(node=>node.props.style),gold.props.children.map(node=>node.props.style));
eq(strips.map(node=>node.key),descendants(later).filter(node=>hasClass(node,'mask-reel-strip')).map(node=>node.key),'Non-reel serial changes do not remount strips.');
const clone=before.map(column=>column.map(cell=>({...cell})));ok(maskCascadeCells(before,clone).every(cell=>!cell.moving&&cell.offsetRows===0),'ID equality, not object allocation, determines movement.');
const fakeSpin={initial:before,terminal:clone,frames:[{phase:'cascade',before,after:clone,wins:[],goldenCells:[],payoutCents:0}],freeSpin:false,payoutCents:0,awardedSpins:0,goldenCells:[]};
eq(maskSlotSteps({mode:'paid',initialFreeSpins:0,spins:[fakeSpin],payoutCents:0,capReached:false},before).steps.map(step=>step.phase),['reel','summary'],'Same IDs create no fake cascade/respin.');

// Every gravity permutation reachable by removing a subset of one column.
let gravityCases=0;
for(let mask=0;mask<32;mask++){
 const old=board(6,5),kept=old[2].filter((_,r)=>!(mask&(1<<r))),n=5-kept.length,newGrid=old.map(column=>[...column]);
 newGrid[2]=[...Array.from({length:n},(_,r)=>({id:'new:'+mask+':'+r,kind:'flag'})),...kept];
 for(const cell of maskCascadeCells(old,newGrid)){
  ok(Object.isFrozen(cell));const original=old[cell.column].findIndex(value=>value.id===cell.id);
  eq(cell.offsetRows,original>=0?original-cell.row:-n);eq(cell.moving,original!==cell.row);
  if(!cell.moving)eq(cell.offsetRows,0);else ok(cell.offsetRows<0,'All reachable gravity/refill begins above target.');
 }
 gravityCases++;
}

// Real engine timelines: one real-spin reel, genuine cascades, totals held
// until spin summary, reveal before boosts/collection, no mutation or rerolls.
const coverage={rounds:0,spins:0,cascades:0,stationary:0,moving:0,collections:0,repeatCollections:0,stickyHolds:0,caps:0,ordinaryCaps:0,bonusPayments:0};
for(const [game,mode,tier]of[['maskhouse','paid','sticky'],['maskhouse','buy','sticky'],['lecipher','paid','luck'],['lecipher','buy','luck'],['lecipher','buy','gold']])for(let seed=0;seed<100;seed++){
 const round=playMaskSlot({game,mode,bonusTier:tier,stakeCents:500,randomInt:rng(40019+seed*131+(game==='maskhouse'?90000:0)+(mode==='buy'?170000:0)+(tier==='gold'?250000:0))});
 const serialized=JSON.stringify(round),timeline=maskSlotSteps(round,board(rules[game].columns,rules[game].rows));coverage.rounds++;coverage.spins+=round.spins.length;coverage.caps+=+round.capReached;coverage.ordinaryCaps+=+(round.ordinaryCapReached||false);
 eq(JSON.stringify(round),serialized);eq(timeline.duration,timeline.steps.reduce((sum,step)=>sum+step.ms,0));eq(timeline.steps.filter(step=>step.phase==='reel').length,round.spins.length);
 eq(timeline.terminal.totalPayoutCents,round.payoutCents);eq(timeline.terminal.capped,round.capReached);eq(timeline.terminal.grid,round.spins.at(-1).terminal);
 let spinIndex=-1,credited=0,group=[];
 const checkGroup=()=>{if(spinIndex<0||!group.length)return;const spin=round.spins[spinIndex];
  eq(group[0].grid,spin.initial);eq(group[0].ms,1900);eq(group[0].reelDurationMs,1600);eq(group[0].reelDelayMs,40);ok(1600+(rules[game].columns-1)*40<=group[0].ms);
  const frameCascades=spin.frames.filter(frame=>frame.phase==='cascade'&&frame.after.flat().some((cell,i)=>cell.id!==frame.before.flat()[i].id));
  const cascades=group.filter(step=>step.phase==='cascade');eq(cascades.length,frameCascades.length);
  for(let i=0;i<cascades.length;i++){const step=cascades[i],frame=frameCascades[i];eq(step.grid,frame.after);eq(step.previous,frame.before);eq(step.cascadeCells,maskCascadeCells(frame.before,frame.after));eq(step.ms,1200);ok(900+(rules[game].columns-1)*20<=step.ms);coverage.cascades++;
   for(const cell of step.cascadeCells){if(cell.moving)coverage.moving++;else{coverage.stationary++;eq(cell.offsetRows,0);}}
  }
  const expectedCollect=spin.frames.filter(frame=>frame.phase==='collect');eq(group.filter(step=>step.phase==='collect').length,expectedCollect.length);eq(group.filter(step=>step.phase==='decode').length,expectedCollect.filter(frame=>!frame.collectionIndex).length);
  const expectedPayments=spin.frames.filter(frame=>frame.phase==='bonus-payment'),payments=group.filter(step=>step.phase==='bonus-payment');eq(payments.length,expectedPayments.length);
  for(let i=0;i<payments.length;i++){const payment=payments[i],frame=expectedPayments[i];coverage.bonusPayments++;eq(payment.grid,frame.after);eq(frame.before,frame.after);eq(payment.wins,[]);eq(payment.bonusPaymentCents,frame.payoutCents);eq(payment.ms,1900);const nodes=descendants(render(payment,game));ok(!nodes.some(node=>hasClass(node,'mask-cascade-drop')||hasClass(node,'is-reeling')||hasClass(node,'mask-cell-win')),'Bonus payment moves no cells and invents no line highlight.');}
  for(const step of group){eq(step.totalPayoutCents,credited,'Intermediate frames do not add financial credit.');if(step.phase==='win')eq(step.ms,1500);if(step.phase==='decode')eq(step.ms,1000);if(step.phase==='reveal-coins')eq(step.ms,1600);if(step.phase==='boost')eq(step.ms,1100);if(step.phase==='collect')eq(step.ms,1900);}
  for(const frame of expectedCollect){coverage.collections++;coverage.repeatCollections+=+(frame.collectionIndex>0);const reveal=group.findIndex(step=>step.phase==='reveal-coins'&&step.grid===frame.after),collect=group.findIndex(step=>step.phase==='collect'&&step.grid===frame.after);ok(reveal>=0&&collect>reveal);eq(group[collect].featurePayoutCents,frame.payoutCents);const expectedLabels=frame.wins.filter(win=>['coin','collector'].includes(win.collectionType)).flatMap(win=>win.cells.map(({column,row})=>({id:frame.after[column][row].id,payoutCents:win.payoutCents})));eq(maskCollectionPayouts(frame),expectedLabels);eq(group[collect].cellPayouts,expectedLabels);ok(!group[reveal].cellPayouts?.length,'No monetary credit label before actual collection.');for(const step of group.filter(step=>['decode','boost'].includes(step.phase)&&step.grid===frame.after))ok(!step.cellPayouts?.length);}
  if(spin.freeSpin&&group[0].previous)for(let c=0;c<spin.initial.length;c++)for(let r=0;r<spin.initial[c].length;r++){const old=group[0].previous[c][r],cell=spin.initial[c][r];if(old.kind==='wild'&&old===cell)coverage.stickyHolds++;}
 };
 for(const step of timeline.steps){if(step.phase==='reel'){checkGroup();group=[step];spinIndex++;}else if(step.phase==='summary'){checkGroup();const spin=round.spins[spinIndex];credited+=spin.payoutCents;eq(step.totalPayoutCents,credited);eq(step.freeRemaining,spin.freeSpinsRemaining);eq(step.ms,1000);group=[];}else if(spinIndex>=0&&group.length)group.push(step);}
 eq(credited,round.payoutCents);
}
ok(coverage.cascades>100);ok(coverage.stationary>100);ok(coverage.moving>100);ok(coverage.collections>100);ok(coverage.stickyHolds>0);ok(coverage.caps+coverage.ordinaryCaps>0);if(rules.bonusMinimumReturnBasisPoints)ok(coverage.bonusPayments>0);

// A repeated pot gets one decode, separate reveals/collects, and one final credit.
const fixture=board(6,5).map(column=>column.map(cell=>cell.kind));fixture[5][4]='bomb';
let scriptCursor=0;const tickets=[0,0,97,97,0,0,0,0,0,0],potSpin=playMaskSpin({game:'lecipher',stakeCents:500,freeSpin:true,bonusTier:'gold',initialGrid:fixture,goldenCells:[{column:0,row:0},{column:1,row:0},{column:2,row:0}],randomInt:max=>{const value=tickets[scriptCursor++]??0;ok(value<max);return value;}});
const potRound={mode:'buy',bonusPurchaseTier:'gold',initialFreeSpins:1,spins:[{...potSpin,freeSpinsRemaining:0}],payoutCents:potSpin.payoutCents,capReached:potSpin.capReached},potTimeline=maskSlotSteps(potRound,fixture);
eq(potSpin.frames.filter(frame=>frame.phase==='collect').length,2);eq(potTimeline.steps.filter(step=>step.phase==='decode').length,1);eq(potTimeline.steps.filter(step=>step.phase==='reveal-coins').length,2);eq(potTimeline.steps.filter(step=>step.phase==='collect').length,2);eq(potTimeline.terminal.totalPayoutCents,potSpin.payoutCents);
const decode=potTimeline.steps.find(step=>step.phase==='decode'),reveal=potTimeline.steps.find(step=>step.phase==='reveal-coins'),collected=potTimeline.steps.filter(step=>step.phase==='collect').at(-1);ok(!renderToStaticMarkup(render(decode)).includes('mask-token-mark'),'Fresh reward labels stay hidden during decode.');ok(!renderToStaticMarkup(render(reveal)).includes('mask-token-mark'),'Monetary labels wait until credited collection.');ok(renderToStaticMarkup(render(collected)).includes('mask-token-mark'),'Collection shows actual credited portions.');

// Deliberately clipped coins/collector: the renderer must never substitute an
// enormous raw face value for the actually credited cell portions.
const nominalGrid=board(6,5);nominalGrid[0][0]={id:'nominal-coin',kind:'bomb',coin:true,collectionType:'coin',value:999999};nominalGrid[1][0]={id:'nominal-pot',kind:'bomb',coin:true,collectionType:'collector',value:888888};nominalGrid[2][0]={id:'actual-booster',kind:'bomb',coin:true,collectionType:'booster',value:10};
const clippedFrame={after:nominalGrid,wins:[{collectionType:'coin',cells:[{column:0,row:0}],payoutCents:233,rawPayoutCents:99999999},{collectionType:'collector',cells:[{column:1,row:0}],payoutCents:155,rawPayoutCents:88888888}],payoutCents:388};
eq(maskCollectionPayouts(clippedFrame),[{id:'nominal-coin',payoutCents:233},{id:'nominal-pot',payoutCents:155}]);
const nominalReveal=renderToStaticMarkup(render(propsFor(nominalGrid,{phase:'reveal-coins'}))),actualCollect=renderToStaticMarkup(render(propsFor(nominalGrid,{phase:'collect',cellPayouts:maskCollectionPayouts(clippedFrame)})));
ok(!nominalReveal.includes(' АР'),'Coin monetary labels are withheld through reveal.');ok(nominalReveal.includes('×10'),'The real booster multiplier is allowed at reveal.');ok(actualCollect.includes('2,33 АР'));ok(actualCollect.includes('1,55 АР'));ok(!actualCollect.includes('999999')&&!actualCollect.includes('888888')&&!actualCollect.includes('40+×'));

// A held House WILD appears as a fixed overlay with two invisible strip slots.
const held=Object.freeze({id:'held-mask',kind:'wild',value:3}),oldHouse=board(5,3),newHouse=board(5,3);oldHouse[2][1]=held;newHouse[2][1]=held;
const heldTree=render(propsFor(newHouse,{phase:'reel',previous:oldHouse,freeSpin:true,reelDurationMs:1600,reelDelayMs:40}),'maskhouse'),heldNodes=descendants(heldTree);
eq(heldNodes.filter(node=>hasClass(node,'mask-sticky-fixed')).length,1);eq(heldNodes.filter(node=>hasClass(node,'mask-held-placeholder')).length,2);eq(heldNodes.filter(node=>hasClass(node,'mask-sticky-fixed'))[0].props.style.top,(1/3*100)+'%');
eq(heldNodes.filter(node=>hasClass(node,'mask-slot-cell')).length,31,'Whole spin keeps both old/new grids plus held overlay; field is not cleared.');

// Independent cent-exact House line oracle: published base pay times the SUM
// of participating WILD values, never their product or stake/20.
const lineCases=[];
for(const freeSpin of[false,true])for(const count of[3,4,5])for(const values of[[],[2],[3],[2,3],[2,2,3]]){
 if(values.length>Math.min(3,count-1))continue;const grid=Array.from({length:5},()=>Array.from({length:3},()=>({kind:'scatter'})));for(let c=0;c<count;c++)grid[c][1]={kind:'hood'};values.forEach((value,i)=>{grid[i+1][1]={kind:'wild',value};});
 const wildScale=freeSpin?rules.maskhouse.freePayScaleBasisPoints:rules.maskhouse.payScaleBasisPoints,noWildScale=(freeSpin?rules.maskhouse.freeNoWildPayScaleBasisPoints:rules.maskhouse.noWildPayScaleBasisPoints)??wildScale,scale=values.length?wildScale:noWildScale,multiplier=values.length?values.reduce((a,b)=>a+b,0):1,percent=[261,653,1958][count-3],stakeCents=25000;
 const expected=Number(BigInt(stakeCents)*BigInt(percent)*BigInt(multiplier)*BigInt(scale)/1000000n),line=evaluateMaskHouseLines(grid,stakeCents,wildScale,noWildScale).find(win=>win.line===0);
 eq(line.count,count);eq(line.multiplier,multiplier);eq(line.payoutCents,expected);lineCases.push({freeSpin,count,values,multiplier,payoutCents:expected});
}
const sharedGrid=board(5,3).map(column=>column.map(cell=>cell.kind));sharedGrid[0][1]='hood';sharedGrid[1][0]={kind:'wild',value:3};sharedGrid[1][1]={kind:'wild',value:2};sharedGrid[2][1]='hood';sharedGrid[3][1]='flag';
for(const freeSpin of[false,true]){const spin=playMaskSpin({game:'maskhouse',stakeCents:500,freeSpin,initialGrid:sharedGrid,randomInt:()=>0});eq(spin.initial[1][1].value,freeSpin?2:3);const line=spin.frames[0].wins.find(win=>win.line===0);eq(line.multiplier,freeSpin?2:3);const scale=freeSpin?rules.maskhouse.freePayScaleBasisPoints:rules.maskhouse.payScaleBasisPoints;eq(line.rawPayoutCents,Number(500n*261n*BigInt(freeSpin?2:3)*BigInt(scale)/1000000n));}

// Synthetic zero-win bonus receipt also exercises the new path before a live
// v8 engine is integrated: real money, identical IDs, no pretend reel/win.
const paymentGrid=board(6,5),paymentSpin={initial:paymentGrid,terminal:paymentGrid,frames:[{phase:'bonus-payment',before:paymentGrid,after:paymentGrid,wins:[{kind:'bonus-payment',cells:[],bonusPayment:true,payoutCents:500}],goldenCells:[],payoutCents:500}],freeSpin:false,payoutCents:500,awardedSpins:0,goldenCells:[],freeSpinsRemaining:0};
const paymentTimeline=maskSlotSteps({game:'lecipher',mode:'paid',initialFreeSpins:0,spins:[paymentSpin],payoutCents:500,capReached:false},paymentGrid);
eq(paymentTimeline.steps.map(step=>step.phase),['reel','bonus-payment','summary']);const receipt=paymentTimeline.steps[1];eq(receipt.bonusPaymentCents,500);eq(receipt.totalPayoutCents,0);eq(receipt.grid,paymentGrid);eq(receipt.wins,[]);eq(paymentTimeline.steps[2].totalPayoutCents,500);
const audioEvents=[],audio={beginRound:(...args)=>audioEvents.push(['begin',...args]),endRound:()=>audioEvents.push(['end']),play:name=>audioEvents.push(['effect',name])};
maskSlotStepAudio(audio,paymentTimeline.steps[0],null);maskSlotStepAudio(audio,receipt,paymentTimeline.steps[0]);eq(audioEvents.filter(event=>event[0]==='begin').length,1);eq(audioEvents.filter(event=>event[0]==='end').length,1);ok(audioEvents.some(event=>event[0]==='effect'&&event[1]==='receipt'));ok(!audioEvents.some(event=>event[0]==='effect'&&event[1]==='cascade'));

// Actual Hall and animation clock: natural finish, skip, reduced motion,
// hidden pause, and unmount settle the immutable result exactly once.
let ledgerPaths=0;
for(const [game,mode,tier]of[['maskhouse','paid','sticky'],['maskhouse','buy','sticky'],['lecipher','paid','luck'],['lecipher','buy','gold']])for(const route of['natural','skip','reduced','hidden','unmount']){
 let draws=0;const random=rng(90197+ledgerPaths),session=new HallSession(null,max=>{draws++;return random(max);},{initialBalanceCents:10000000}),opening=session.balanceCents,round=session.begin(game,game,5,{mode,...(mode==='buy'?{bonusTier:tier}:{})}),timeline=maskSlotSteps(round,round.spins[0].initial),drawsAtIssue=draws;
 eq(session.balanceCents,opening-round.chargeCents);let hidden=false,next=0,callbacks=new Map(),completions=0,shows=0,lastProgress=0;
 const task=createRoundPlayback({duration:timeline.duration,requestFrame:fn=>{callbacks.set(++next,fn);return next;},cancelFrame:id=>callbacks.delete(id),isHidden:()=>hidden,onProgress:p=>{ok(p>=lastProgress);lastProgress=p;eq(session.balanceCents,opening-round.chargeCents,'No credit during motion.');},onComplete:show=>{completions++;shows+=+show;eq(session.complete(round.id),true);eq(session.balanceCents,opening-round.chargeCents+round.payoutCents);}});
 const pump=now=>{const queued=[...callbacks.values()];callbacks.clear();queued.forEach(fn=>fn(now));};task.start();const late=[...callbacks.values()][0];
 const advance=(start,elapsed)=>{for(let t=100;t<=elapsed+100;t+=100)pump(start+t);};
 if(route==='reduced')task.finish();else{pump(0);if(route==='natural'){advance(0,timeline.duration);}else if(route==='hidden'){advance(0,1000);const stopped=lastProgress;hidden=true;task.visibilityChanged();late(500000);eq(lastProgress,stopped);eq(completions,0);hidden=false;task.visibilityChanged();pump(500000);eq(lastProgress,stopped);advance(500000,timeline.duration);}else task.finish(route!=='unmount');}
 eq(completions,1);eq(shows,route==='unmount'?0:1);eq(task.finish(),false);late(9999999);eq(completions,1);eq(session.complete(round.id),false);eq(draws,drawsAtIssue,'Playback cannot reroll or consume RNG.');eq(session.getSnapshot().result.payoutCents,round.payoutCents);ledgerPaths++;
}

// CSS/DOM supports the slower declared intervals and stationary overlay.
const css=postcss.parse(source['src/MaskSlotRoom.css']);
const declaration=(selector,property)=>{let result;css.walkRules(rule=>{if(rule.selector===selector)rule.walkDecls(property,node=>{result=node.value;});});return result;};
eq(declaration('.mask-golden-grid','position'),'absolute');eq(declaration('.mask-golden-grid','pointer-events'),'none');ok(declaration('.mask-cascade-drop','animation').includes('.9s'));ok(declaration('.mask-cascade-drop','animation-delay').includes('20ms'));
ok(source['src/MaskSlotRoom.css'].includes('.mask-cascade-drop,.mask-cell-win'));ok(source['src/MaskSlotRoom.css'].includes('.lexof-rainbow-feature { animation:none !important; }')||source['src/MaskSlotRoom.css'].includes('.mask-feature-amount,.lexof-rainbow-feature { animation:none !important; }'));
ok(source['src/MaskSlotRoom.jsx'].includes("visual.phase==='decode'&&atlas&&<div className=\"lexof-rainbow-feature\""),'Large feature is limited to decode.');eq(declaration('.lexof-rainbow-feature .mask-slot-symbol','width'),'180px');
for(const name of files)eq(hash(readFileSync(new URL(name,site),'utf8')),sourceSHA256[name],'Live source changed during read-only test; rerun after final integration.');
console.log(JSON.stringify({passed:true,checks,gravityCases,coverage,ledgerPaths,independentWildLineCases:lineCases.length,sourceSHA256}));
