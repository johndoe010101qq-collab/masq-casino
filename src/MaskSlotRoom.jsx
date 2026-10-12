import React,{useEffect,useRef,useState} from 'react';
import {getSlotAtlas} from './art/renderSlotAtlas.js';
import {MASK_SLOT_RULES,MASK_REGULAR_KINDS,LEXOF_FEATURE_RULES} from './mask-slots.js';
import {permittedStake} from './stake-limits.js';
import {uiStakeLimits,uiBoundedStake,uiPlaybackSpeed} from './demo-ui-settings.js';
import {createRoundPlayback} from './RoundPlayback.js';
import {maskSlotSteps,maskSlotStepAudio} from './mask-slot-presentation.js';
import {validateBonusPurchase} from './hall-session.js';
import {useReducedMotion} from './SceneMotion.jsx';
import {SLOT_THEMES} from './slot-themes.js';
import './MaskSlotRoom.css';
import './SlotExperience.css';
import {scaleSlotPresentation} from './scaleSlotPresentation.js';
import {useSlotPlaybackControls} from './useSlotPlaybackControls.js';
import SlotPlaybackOptions from './SlotPlaybackOptions.jsx';
import SlotDock from './SlotDock.jsx';
import SlotBonusShop from './SlotBonusShop.jsx';
import LexofMascot,{LexofPortrait} from './LexofMascot.jsx';
import HouseMascot from './HouseMascot.jsx';
import SlotWinReadout from './SlotWinReadout.jsx';
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:2}).format(n);
const title={maskhouse:'Mask Hou$e',lecipher:'LeXof'};
const tierTitle={sticky:'Маскарад',luck:'Тайник',gold:'Золотой архив',treasure:'Главный код'};
function Symbol({cell,atlas,payoutCents}) {
 const index=atlas.indices[cell.coin&&cell.collectionType==='coin'?'flag':cell.kind];
 const glyph=cell.collectionType==='booster'?'/lexof-amplifier.png':cell.collectionType==='collector'?'/lexof-archive.png':null;
 return <>{glyph?<img className="mask-collection-glyph" src={glyph} alt=""/>:<span className="mask-slot-symbol" style={{backgroundImage:`url('${atlas.url}')`,backgroundPosition:`${index%4/3*100}% ${Math.floor(index/4)/2*100}%`}}/>}{cell.kind==='wild'&&<b className="mask-wild-mark">WILD ×{cell.value}</b>}{cell.collectionType==='booster'?<b className="mask-token-mark">×{fmt(cell.value)}</b>:payoutCents!==undefined?<b className="mask-token-mark">{fmt(payoutCents/100)} АР</b>:null}</>;
}
function Board({visual,atlas,config,idle,names}) {
 const grid=visual.grid,previous=visual.previous||idle;
 const payouts=new Map((visual.cellPayouts||visual.coinPreviewPayouts||[]).map(cell=>[cell.id,cell.payoutCents]));
 const winning=new Set(visual.wins.flatMap(w=>w.cells.map(p=>p.column+':'+p.row)));
 const golden=new Set((visual.goldenCells||[]).map(p=>p.column+':'+p.row));
 const sticky=visual.freeSpin?grid.flatMap((column,c)=>column.flatMap((item,r)=>item.kind==='wild'&&(visual.phase!=='reel'||previous[c]?.[r]?.id===item.id)?[{item,c,r}]:[])):[];
 const held=new Set(sticky.map(({c,r})=>c+':'+r));
 const removed=new Set((visual.removedCells||[]).map(p=>p.column+':'+p.row));
 const boosted=new Set((visual.clovers||[]).flatMap(p=>[[p.column-1,p.row],[p.column+1,p.row],[p.column,p.row-1],[p.column,p.row+1]].map(([c,r])=>c+':'+r)));
 const motion=new Map((visual.cascadeCells||[]).map(cell=>[cell.id,cell]));
 const cell=(item,c,r,old=false)=>{const drop=!old&&visual.phase==='cascade'?motion.get(item.id):null;return <div key={(old?'old:':'')+item.id} style={{'--cell-order':c*config.rows+r,'--drop-y':(drop?.offsetRows||0)*100+'%','--column':c}} className={'mask-slot-cell'+(drop?.moving?' mask-cascade-drop':'')+(!old&&winning.has(c+':'+r)?' mask-cell-win':'')+(!old&&golden.has(c+':'+r)?' mask-on-gold':'')+(removed.has(c+':'+r)&&!old?' mask-removing':'')+(item.coin?' mask-coin mask-coin-'+item.collectionType:'')+(item.kind==='bomb'&&item.activation?' mask-decoder':'')+(item.kind==='wild'&&visual.freeSpin?' mask-sticky':'')+(held.has(c+':'+r)?' mask-held-placeholder':'')} aria-hidden={old?'true':undefined} aria-label={!old?(item.coin?({coin:'Монета',booster:'Усилитель',collector:'Архив'}[item.collectionType]||'Монета')+(item.collectionType==='booster'?' ×'+fmt(item.value):payouts.has(item.id)?' · выплата '+fmt(payouts.get(item.id)/100)+' АР':''):names[item.kind]):undefined}><Symbol cell={item} atlas={atlas} payoutCents={old?undefined:payouts.get(item.id)}/></div>;};
 return <div className={'mask-slot-grid phase-'+visual.phase} data-active-line={visual.activeLine?.line} style={{'--cols':config.columns,'--rows':config.rows}}>
  <div className="mask-golden-grid" aria-hidden="true">{(visual.goldenCells||[]).map(p=><i key={p.column+':'+p.row} className="mask-golden-cell mask-cell-gold" style={{gridColumn:p.column+1,gridRow:p.row+1}}/>)}</div>
  {grid.map((column,c)=><div className="mask-reel-window" key={c}><div key={visual.phase==='reel'?'spin:'+visual.serial:'board'} className={'mask-reel-strip'+(visual.phase==='reel'?' is-reeling':'')} style={{'--column':c,'--reel-ms':(visual.reelDurationMs||1600)+'ms','--reel-delay-ms':(visual.reelDelayMs||40)+'ms'}}>{column.map((item,r)=>cell(item,c,r))}{visual.phase==='reel'&&previous[c].map((item,r)=>cell(item,c,r,true))}</div>{sticky.filter(item=>item.c===c).map(({item,r})=><div className={'mask-slot-cell mask-sticky mask-sticky-fixed'+(winning.has(c+':'+r)?' mask-fixed-win':'')} key={'held:'+item.id} style={{left:0,top:`${r/config.rows*100}%`,width:'100%',height:`${100/config.rows}%`}} aria-hidden="true"><Symbol cell={item} atlas={atlas}/></div>)}</div>)}
  <div className="mask-cell-overlay" aria-hidden="true">{grid.flatMap((column,c)=>column.flatMap((item,r)=>{
   const here=c+':'+r,classes=[removed.has(here)&&'cell-removing',visual.phase==='scatter'&&item.kind==='scatter'&&'cell-trigger',visual.phase==='boost'&&boosted.has(here)&&'cell-boosted',visual.phase==='collector'&&visual.activeCollector?.column===c&&visual.activeCollector?.row===r&&'cell-collecting'].filter(Boolean);
   return classes.length?<i key={here} className={classes.join(' ')} style={{gridColumn:c+1,gridRow:r+1}}/>:[];
  }))}</div>
  {visual.activeLine&&<svg className="mask-paying-line" viewBox={`0 0 ${config.columns*100} ${config.rows*100}`} preserveAspectRatio="none" aria-hidden="true"><polyline points={visual.activeLine.cells.map(p=>`${p.column*100+50},${p.row*100+50}`).join(' ')}/></svg>}
  {visual.phase==='collect'&&(visual.collectionCells||[]).filter(p=>p.type==='coin').map((p,index)=><span key={'flight:'+p.column+':'+p.row} className="mask-coin-flight" aria-hidden="true" style={{left:`${(p.column+.5)/config.columns*100}%`,top:`${(p.row+.5)/config.rows*100}%`,'--flight-delay':index*18+'ms','--flight-x':(config.columns/2-p.column-.5)*12+'px'}}><span className="mask-slot-symbol" style={{backgroundImage:`url('${atlas.url}')`,backgroundPosition:'0% 100%'}}/></span>)}
 </div>;
}
function Purchase({game,request,onCancel,onConfirm,returnFocus}) {
 const dialog=useRef(null),cancel=useRef(null);
 const titleId='purchase-title-'+game,descriptionId='purchase-details-'+game;
 useEffect(()=>{
  const node=dialog.current,previousFocus=returnFocus||document.activeElement;
  if(typeof node.showModal==='function')node.showModal();else node.setAttribute('open','');
  cancel.current?.focus({preventScroll:true});
  return()=>{
   if(node.open&&typeof node.close==='function')node.close();
   queueMicrotask(()=>{if(previousFocus instanceof HTMLElement&&previousFocus.isConnected&&!previousFocus.matches(':disabled'))previousFocus.focus({preventScroll:true});});
  };
 },[]);
 return <dialog ref={dialog} className={'mask-purchase '+game} aria-labelledby={titleId} aria-describedby={descriptionId} onCancel={event=>{event.preventDefault();onCancel();}} onClick={event=>{if(event.target===dialog.current)onCancel();}}>
  <button type="button" className="mask-purchase-close" aria-label="Закрыть покупку бонуса" onClick={onCancel}>×</button>
  {game==='lecipher'?<LexofPortrait className="mask-purchase-emblem"/>:<img className="mask-purchase-emblem" src="/maskhouse-cover.png" alt=""/>}
  <h2 id={titleId}>{tierTitle[request.bonus.id]}</h2>
  <p id={descriptionId} className="mask-purchase-feature"><strong>{game==='maskhouse'?'9–27':request.bonus.initialFreeSpins}</strong> бесплатных вращений{request.bonus.id==='gold'?' · постоянное золотое поле':''}</p>
  <dl className="mask-purchase-terms"><div><dt>Базовая ставка</dt><dd>{fmt(request.stake)} АР</dd></div><div><dt>Стоимость бонуса</dt><dd>{fmt(request.cost)} АР</dd></div></dl>
  <p className="mask-purchase-note">Минимальная итоговая выплата купленного бонуса — 10% его стоимости. Полные условия — в правилах шансов.</p>
  <p className="mask-purchase-note">Бонусный режим останется включён до отмены. Каждый следующий запуск снова стоит {fmt(request.cost)} АР при этой ставке.</p>
  <div className="mask-purchase-actions"><button ref={cancel} type="button" onClick={onCancel}>Отмена</button><button type="button" className="primary" onClick={onConfirm}>Купить за {fmt(request.cost)} АР</button></div>
 </dialog>;
}
export default function MaskSlotRoom({game,session,snapshot,audio,onSettled,payoutOpen}) {
 const config=MASK_SLOT_RULES[game],reduced=useReducedMotion(),names=SLOT_THEMES[game].names;
 const limits=uiStakeLimits(snapshot,game);
 const [idle]=useState(()=>Array.from({length:config.columns},(_,c)=>Array.from({length:config.rows},(_,r)=>({id:'idle-'+c+'-'+r,kind:MASK_REGULAR_KINDS[(c*3+r*2)%9]}))));
 const [visual,setVisual]=useState({phase:'idle',grid:idle,wins:[],goldenCells:[],freeRemaining:0,totalPayoutCents:0});
 const [atlas,setAtlas]=useState(null),[error,setError]=useState(''),[stake,setStake]=useState('50'),[rulesOpen,setRulesOpen]=useState(false);
 const [purchase,setPurchase]=useState(null),[shopOpen,setShopOpen]=useState(false),[featureMode,setFeatureMode]=useState(null);
 const [bonusMode,setBonusMode]=useState(null);
 const pendingPurchase=useRef(null);
 useEffect(()=>{setStake(value=>String(uiBoundedStake(value,limits)));setError('');},[limits.min,limits.max,limits.step]);
 const purchaseTrigger=useRef(null);
 const runner=useRef(null),mounted=useRef(false),stage=useRef(null),pausedAnimations=useRef([]),latest=useRef({audio,onSettled});latest.current={audio,onSettled};
 useEffect(()=>{let live=true;setAtlas(null);getSlotAtlas(game).then(a=>{if(live)setAtlas(a);}).catch(()=>{if(live)setError('Не удалось загрузить изображения. Обновите страницу.');});return()=>{live=false;};},[game]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;runner.current?.finish(false);};},[session]);
 useEffect(()=>{if(reduced)runner.current?.finish();},[reduced]);
 useEffect(()=>{
  const changed=()=>{
   if(stage.current)stage.current.dataset.playbackPaused=String(document.hidden);
   if(document.hidden){pausedAnimations.current=(stage.current?.getAnimations?.({subtree:true})||[]).filter(a=>a.playState==='running');pausedAnimations.current.forEach(a=>a.pause());}
   else{pausedAnimations.current.forEach(a=>{if(a.playState==='paused')a.play();});pausedAnimations.current=[];}
  };
  changed();document.addEventListener('visibilitychange',changed);return()=>{document.removeEventListener('visibilitychange',changed);pausedAnimations.current=[];};
 },[]);
 const [roundSpeed,setRoundSpeed]=useState(1);
 const canAffordSpin=current=>bonusMode
  ? !validateBonusPurchase(Number(stake),current.balance,game,bonusMode,uiStakeLimits(current,game))
  : permittedStake(Number(stake),uiStakeLimits(current,game))&&current.balance>=Number(stake);
 const controls=useSlotPlaybackControls({busy:snapshot.busy,getBusy:()=>session.getSnapshot().busy,ready:!!atlas,defaultSpeed:uiPlaybackSpeed(snapshot.presentation),modalOpen:!!purchase||shopOpen||rulesOpen,payoutOpen,normalOnly:!featureMode,canAfford:canAffordSpin(snapshot),getCanAfford:()=>canAffordSpin(session.getSnapshot()),requestSpin:settings=>play(bonusMode?'buy':'paid',Number(stake),bonusMode??undefined,settings)});
 const locked=controls.active||snapshot.busy||payoutOpen||!!purchase||shopOpen,amount=Number(stake),validStake=permittedStake(amount,limits);
 const offers=game==='lecipher'?[...Object.values(LEXOF_FEATURE_RULES).map(item=>({...item,feature:true})),...config.bonusBuys]:config.bonusBuys;
 const feature=bonusMode?{...config.bonusBuys.find(item=>item.id===bonusMode),name:tierTitle[bonusMode],persistent:true,onDisable:()=>{controls.stopAutoplay();setBonusMode(null);}}:featureMode?{...LEXOF_FEATURE_RULES[featureMode],name:featureMode==='hunt'?'Охота за бонусом':'Радужный спин',onDisable:()=>setFeatureMode(null)}:null;
 const stakeHelpId='stake-help-'+game,errorId='stake-error-'+game;
 function buy(bonus,trigger) {if(session.getSnapshot().busy||payoutOpen||pendingPurchase.current||runner.current||!atlas)return;const current=session.getSnapshot(),issue=validateBonusPurchase(amount,current.balance,game,bonus.id,uiStakeLimits(current,game));if(issue){setError(issue);return;}setError('');purchaseTrigger.current=trigger||document.activeElement;pendingPurchase.current=Object.freeze({stake:amount,bonus,cost:amount*bonus.multiplier});setPurchase(pendingPurchase.current);}
 function openBonusShop() {
  purchaseTrigger.current=document.activeElement;
  if(offers.length===1&&!offers[0].feature)buy(offers[0],purchaseTrigger.current);
  else setShopOpen(true);
 }
 function confirmPurchase() {
  const request=pendingPurchase.current;
  if(!request)return;
  pendingPurchase.current=null;
  setPurchase(null);
  if(play('buy',request.stake,request.bonus.id))setBonusMode(request.bonus.id);
 }
 function cancelPurchase() {pendingPurchase.current=null;setPurchase(null);}
 function play(mode='paid',amount=Number(stake),bonusTier,playbackOptions={}) {
  if(snapshot.busy||payoutOpen||runner.current||!atlas)return false;
  let round;try{round=session.begin(game,game,amount,{mode,bonusTier,...(mode==='paid'&&featureMode&&playbackOptions.featureMode!==null?{featureMode}: {})});}catch(e){setError(e.message);return false;}
  if(!round)return false;setError('');setFeatureMode(null);const speed=playbackOptions.speed||controls.speed;setRoundSpeed(speed);
  let timeline,task,completed=false;
  const settle=show=>{if(completed)return;completed=true;if(task)document.removeEventListener('visibilitychange',task.visibilityChanged);runner.current=null;const accepted=session.complete(round.id);try{latest.current.audio?.endRound();}catch{}if(mounted.current)setVisual(timeline?.terminal||{phase:'settled',grid:round.spins.at(-1).terminal,wins:[],goldenCells:round.spins.at(-1).goldenCells,freeRemaining:0,totalPayoutCents:round.payoutCents});if(show&&mounted.current&&accepted)latest.current.onSettled?.(session.getSnapshot().result);};
  try {
  timeline=scaleSlotPresentation(maskSlotSteps(round,visual.grid),speed);const starts=[];let total=0,last=-1;
  for(const s of timeline.steps){starts.push(total);total+=s.ms;}
  task=createRoundPlayback({duration:timeline.duration,requestFrame:requestAnimationFrame,cancelFrame:cancelAnimationFrame,isHidden:()=>document.hidden,onError:()=>{queueMicrotask(()=>controls.stopAutoplay());if(mounted.current)setError('Раунд рассчитан. Не удалось показать анимацию.');},onProgress:p=>{
   let i=starts.length-1;while(i>0&&starts[i]>p*timeline.duration)i--;
   if(last===i)return;const previous=timeline.steps[last];last=i;const step=timeline.steps[i];if(mounted.current)setVisual(step);
   try{maskSlotStepAudio(latest.current.audio,{...step,game},previous);}catch{}
  },onComplete:settle});
  runner.current=task;document.addEventListener('visibilitychange',task.visibilityChanged);
  if(reduced)task.finish();else task.start();
  }catch{queueMicrotask(()=>controls.stopAutoplay());settle(false);if(mounted.current)setError('Раунд рассчитан. Не удалось показать анимацию.');}
  return true;
 }
 return <section className={'mask-slot-room '+game} aria-label={title[game]}><div className="room-heading"><h1>{title[game]}</h1><button type="button" className="rules-button" aria-expanded={rulesOpen} aria-controls={'mask-rules-'+game} onClick={()=>setRulesOpen(v=>!v)}>Правила</button></div>
  {rulesOpen&&<div className="mask-slot-rules" id={'mask-rules-'+game}><p>{game==='maskhouse'?'20 линий слева направо. Три и больше одинаковых символа дают выплату. Wild на барабанах 2–4 заменяет обычные символы, имеет ×2 или ×3 и закрепляется в бонусе. Три особняка на барабанах 1, 3 и 5 запускают выбор 9–27 вращений. В бонусе особняков и повторного запуска нет.':'Группы от пяти соседних символов дают выплату и каскад. Выигравшие клетки становятся золотыми. Декодер раскрывает на них монеты, усилители и архивы-сборщики. Три досье открывают «Тайник» на 8 вращений, четыре — «Золотой архив» на 12, пять — «Главный код» на 12. В двух старших бонусах золото сохраняется; в «Главном коде» декодер приходит каждый спин.'}</p><p>Полные таблицы выплат и реальные вероятности доступны во вкладке «Правила шансов».</p></div>}
  <div className="room-layout"><div ref={stage} className="mask-slot-stage" style={{'--slot-speed':roundSpeed}} aria-busy={snapshot.busy} data-phase={visual.phase} data-bonus={visual.bonusTier||'base'}><div className="mask-slot-cabinet" aria-hidden="true"/><div className="slot-scene-light" aria-hidden="true"/><LexofMascot game={game} visual={visual} reducedMotion={reduced}/><HouseMascot game={game} visual={visual} reducedMotion={reduced}/>{!visual.freeRemaining&&<span className="mask-cabinet-title" aria-hidden="true">{title[game]}</span>}{atlas&&<Board visual={visual} atlas={atlas} config={config} idle={idle} names={names}/>}
   {visual.freeRemaining>0&&!['bonus','bonus-selection','profile-gift'].includes(visual.phase)&&<div className="mask-free-count" role="status" aria-label={'Осталось бесплатных вращений: '+visual.freeRemaining}><span>{tierTitle[visual.bonusTier]||'Бонус'}<small>Осталось вращений</small></span><strong key={visual.freeRemaining}>{visual.freeRemaining}</strong></div>}
   {visual.phase==='bonus'&&<div className="mask-bonus-card" role="status">{game==='lecipher'?<LexofPortrait className="mask-bonus-emblem"/>:<img className="mask-bonus-emblem" src="/maskhouse-cover.png" alt=""/>}<span>{tierTitle[visual.bonusTier]||'Бесплатные вращения'}</span><strong>+{visual.added}</strong><small>бесплатных вращений</small></div>}
   {visual.phase==='profile-gift'&&<div className="mask-bonus-card" role="status"><span>Дополнительные вращения</span><strong>+{visual.added}</strong><small>бесплатных вращений</small></div>}
   {visual.phase==='bonus-selection'&&<div className="mask-bonus-card mask-bonus-selection" role="status"><span>Маскарад</span><div className="mask-award-tiles">{visual.bonusSelection.map((value,index)=><b key={index} data-revealed={index<(visual.revealed||9)} style={{'--tile':index}}>{index<(visual.revealed||9)?value:'?'}</b>)}</div><strong>{visual.selectionTotal??visual.freeRemaining}</strong><small>бесплатных вращений</small></div>}
   {game==='lecipher'&&visual.phase==='decode'&&atlas&&<div className="lexof-rainbow-feature" key={visual.serial} aria-hidden="true"><span className="mask-slot-symbol" style={{backgroundImage:`url('${atlas.url}')`,backgroundPosition:'66.6667% 100%'}}/><strong>Радуга</strong></div>}
   <SlotWinReadout visual={visual} game={game} atlas={atlas}/>
  </div><SlotDock game={game} stakeLimits={limits} stake={stake} onStakeChange={value=>{setStake(value);setError('');}} balance={snapshot.balance} payout={(visual.shownPayoutCents??visual.totalPayoutCents)/100} locked={locked} busy={snapshot.busy} ready={!!atlas} validStake={validStake} feature={feature} onSpin={()=>play(bonusMode?'buy':'paid',amount,bonusMode??undefined)} onSkip={()=>runner.current?.finish()} onShop={openBonusShop} error={error}/><SlotPlaybackOptions game={game} controls={controls} disabled={locked||!atlas||payoutOpen} autoAllowed={!featureMode&&validStake} bonusMode={bonusMode?tierTitle[bonusMode]:null}/></div>{shopOpen&&<SlotBonusShop game={game} offers={offers} atlas={atlas} stake={amount} balance={snapshot.balance} returnFocus={purchaseTrigger.current} onCancel={()=>setShopOpen(false)} onChoose={bonus=>{setShopOpen(false);if(bonus.feature){setBonusMode(null);setFeatureMode(bonus.id);setError('');}else{setFeatureMode(null);buy(bonus,purchaseTrigger.current);}}}/>}{purchase&&<Purchase game={game} request={purchase} returnFocus={purchaseTrigger.current} onCancel={cancelPurchase} onConfirm={confirmPurchase}/>}</section>;
}
