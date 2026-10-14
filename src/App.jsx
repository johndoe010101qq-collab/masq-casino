import React, { Suspense, lazy, useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { HallSession, validateAmount } from './hall-session.js';
import { adjustedStake } from './stake-limits.js';
import { classicRules, classicProfileSnapshot } from './classic-rtp-profiles.js';
import { slotProfileSnapshot } from './slot-rtp-profiles.js';
import { uiStakeLimits, uiBoundedStake, uiPlaybackSpeed, applyDemoAudio, applyDemoUiSettings } from './demo-ui-settings.js';
import { createAdminProfileDetails } from './demo-admin-profile-details.js';
import bonanzaProfileStatistics from './bonanza-profile-statistics.json';
import maskProfileStatistics from './mask-profile-statistics.json';
import GameMath from './game-math.js';
import { GAME_META } from './game-meta.js';
import { createRoundPlayback } from './RoundPlayback.js';
import { useCasinoAudio } from './audio/useCasinoAudio.js';
import { useReducedMotion, usePageVisible } from './SceneMotion.jsx';
import useSPWMini from './integrations/useSPWMini.js';
import useSiteTools from './integrations/useSiteTools.js';
import './App.css';

import './RasterSlot.css';
import OddsRules from './OddsRules.jsx';
import DemoAdminPanel from './DemoAdminPanel.jsx';
import { canOpenDemoAdmin } from './admin-access.js';
import ServerAdminPanel from './ServerAdminPanel.jsx';
import ServerAdminPage from './ServerAdminPage.jsx';
import {createServerAdminClient} from './integrations/server-admin-client.js';
import {SERVER_ADMIN_ENABLED} from './integrations/spw-app-config.js';
import LobbyV15 from './LobbyV15.jsx';
import { MasqMark, MasqIcon } from './MasqIdentity.jsx';
import './MinecraftInterface.css';
const BonanzaSlot = lazy(() => import('./BonanzaSlot.jsx'));
const MaskSlotRoom = lazy(() => import('./MaskSlotRoom.jsx'));
const RoundArt = lazy(() => import('./RoundArt.jsx'));
const UpgraderHacker = lazy(() => import('./UpgraderHacker.jsx'));
const RasterRoulette = lazy(() => import('./RasterRoulette.jsx'));
const RasterCoinflip = lazy(() => import('./RasterCoinflip.jsx'));
const PlinkoRoom = lazy(() => import('./PlinkoRoom.jsx'));
const BlackjackRoom = lazy(() => import('./BlackjackRoom.jsx'));
const PayoutScene = lazy(() => import('./PayoutScene.jsx'));
const fmt = value => new Intl.NumberFormat('ru-RU', { maximumFractionDigits: 2 }).format(value);
const TITLE = Object.fromEntries(GAME_META.map(game => [game.id, game.name]));
const OPTIONS = { coinflip:[['heads','Маска'],['tails','Число']], dice:[1,2,3,4,5,6].map(n=>[n,String(n)]), roulette:[['red','Красное'],['black','Чёрное'],['green','Зеро']], upgrader:[1.5,2,4,8].map(n=>[n,'×'+fmt(n)]) };
const RULE_TEXT = { coinflip:'Выберите маску или число. Совпадение даёт выплату ×2 ставки.', dice:'Выберите грань кубика. Совпадение даёт выплату ×6 ставки.', roulette:'18 красных, 18 чёрных секторов и зеро. Цвет даёт ×2, зеро — ×36 ставки.', upgrader:'Выберите целевой множитель: ×1,5, ×2, ×4 или ×8. Успешное улучшение даёт указанную выплату от ставки.' };
const getProfileDetails = createAdminProfileDetails({slotProfileSnapshot, classicProfileSnapshot,
  bonanzaStatistics:bonanzaProfileStatistics, maskStatistics:maskProfileStatistics});
const DEMO_ADMIN_CAPABILITIES = Object.freeze({rtpProfiles:true,classicRtpProfiles:true,stakeLimits:true,presentation:true});
function Rules({game,onClose}) {
  const ref=useRef(null);
  useEffect(()=>{const dialog=ref.current;dialog.showModal();return()=>dialog.close();},[]);
  return <dialog ref={ref} className="hall-rules" aria-labelledby={'hall-rules-title-'+game} onCancel={onClose} onClick={event=>{if(event.target===ref.current)onClose();}}><div><button className="close-rules" onClick={onClose} aria-label="Закрыть правила">×</button><span className="eyebrow">ПРАВИЛА</span><h2 id={'hall-rules-title-'+game}>{TITLE[game]}</h2><p>{RULE_TEXT[game]}</p><p>Выплата включает возврат ставки. Все раунды проходят на демонстрационном балансе.</p><button className="secondary" onClick={onClose}>Понятно</button></div></dialog>;
}
function GameRoom({game,session,snapshot,reduced,audio,onSettled,payoutOpen}) {
  const meta=GAME_META.find(row=>row.id===game), [stake,setStake]=useState('50'), [choice,setChoice]=useState(meta.choice), [error,setError]=useState(''), [rules,setRules]=useState(false), [round,setRound]=useState(null), [progress,setProgress]=useState(0);
  const task=useRef(null), resultHoldTimer=useRef(null), mounted=useRef(false), latest=useRef({audio,onSettled}); latest.current={audio,onSettled};
  const [resultHold,setResultHold]=useState(false);
  const pageVisible=usePageVisible(); const locked=snapshot.busy||payoutOpen||resultHold;
  const limits=uiStakeLimits(snapshot,game);
  const currentRules=classicRules(game,choice,snapshot.classicRtpProfiles?.[game]??70);
  useEffect(()=>{setStake(value=>String(uiBoundedStake(value,limits)));setError('');},[limits.min,limits.max,limits.step]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;clearTimeout(resultHoldTimer.current);task.current?.finish(false);};},[session]);
  useEffect(()=>{if(reduced)task.current?.finish();},[reduced]);
  function run(event) {
    event.preventDefault(); if(task.current||resultHoldTimer.current||session.getSnapshot().busy||payoutOpen)return;
    const current=session.getSnapshot();
    const issue=validateAmount(Number(stake),current.balance,game,uiStakeLimits(current,game)); if(issue){setError(issue);return;}
    let next;try{next=session.begin(game,choice,Number(stake));}catch(failure){setError(failure.message);return;}if(!next)return;
    setError('');setRound(next);setProgress(0);
    const durationMs=meta.duration*1000/uiPlaybackSpeed(next.presentation);
    const runner=createRoundPlayback({duration:durationMs,requestFrame:requestAnimationFrame,cancelFrame:cancelAnimationFrame,isHidden:()=>document.hidden,onProgress:value=>{if(mounted.current)setProgress(value);},onComplete:show=>{
      document.removeEventListener('visibilitychange',runner.visibilityChanged);task.current=null;
      const completed=session.complete(next.id);try { latest.current.audio?.endRound(); } catch {};
      if(show&&mounted.current){
        setProgress(1);
        if(completed){
          const result=session.getSnapshot().result;
          if(game==='coinflip'&&!reduced){
            // Settlement is already complete. This pause only lets the minted
            // face be read before a win overlay or another manual toss.
            setResultHold(true);
            resultHoldTimer.current=setTimeout(()=>{
              resultHoldTimer.current=null;
              if(mounted.current){setResultHold(false);latest.current.onSettled?.(result);}
            },850);
          } else latest.current.onSettled?.(result);
        }
      }
    }});
    task.current=runner;document.addEventListener('visibilitychange',runner.visibilityChanged);try { audio?.beginRound(game,{durationMs}); } catch {};
    if(reduced)runner.finish();else runner.start();
  }
  const complete=round&&progress===1&&!snapshot.busy;
  return <><div className="room-heading"><div><h1>{meta.name}</h1></div><button className="rules-button" onClick={()=>setRules(true)}>Правила</button></div>
    <div className="room-layout"><div className={'physical-stage stage-'+game+(snapshot.busy?' is-running':'')} aria-busy={snapshot.busy}><div className="stage-label"><span>{meta.name.toUpperCase()}</span></div>
      {game==='upgrader'?<Suspense fallback={null}><UpgraderHacker targetChoice={choice} round={round} progress={progress} playing={snapshot.busy} reduced={reduced} visible={pageVisible&&!payoutOpen}/></Suspense>:<><div className="mode-cabinet-backdrop" aria-hidden="true"/><div className="physical-canvas"><Suspense fallback={null}>{game==='roulette'?<RasterRoulette round={round} progress={progress} playing={snapshot.busy} reduced={reduced} visible={pageVisible&&!payoutOpen}/>:game==='coinflip'?<RasterCoinflip round={round} progress={progress} playing={snapshot.busy} reduced={reduced} visible={pageVisible&&!payoutOpen}/>:<RoundArt game={game} targetChoice={choice} round={round} progress={progress} playing={snapshot.busy} reduced={reduced} visible={pageVisible&&!payoutOpen}/>}</Suspense></div></>}
      <div className="physical-result" role="status" aria-live="polite" aria-atomic="true">{snapshot.busy?<><span className="stage-running">Раунд идёт</span><button onClick={()=>task.current?.finish()}>Пропустить</button></>:complete?<><span>{game==='coinflip'?(round.face==='heads'?'Выпала маска':'Выпало число 1'):round.label}<small>Ставка {fmt(round.cost)} АР</small></span><strong>Выплата {fmt(round.payout)} АР</strong></>:<span>Выбери ставку и начни раунд</span>}</div>
    </div><form className="room-bet" onSubmit={run} noValidate><label htmlFor={'stake-'+game}>Ставка <span>АР</span></label><input id={'stake-'+game} className="stake-input" type="number" inputMode="numeric" min={limits.min} max={limits.max} step={limits.step} disabled={locked} value={stake} aria-invalid={!!error} aria-describedby={'stake-help-'+game} onChange={event=>{setStake(event.target.value);setError('');}}/>
      <div className="stake-tools">{[['½',.5],['×2',2]].map(([label,factor])=><button key={label} type="button" disabled={locked} onClick={()=>setStake(String(adjustedStake(stake,factor,snapshot.balance,limits)))}>{label}</button>)}<button type="button" disabled={locked} onClick={()=>setStake(String(adjustedStake(limits.max,1,snapshot.balance,limits)))}>Макс.</button></div><small id={'stake-help-'+game}>{limits.min}–{limits.max} АР · шаг {limits.step}</small>
      <fieldset disabled={locked}><legend>{game==='upgrader'?'Множитель':game==='dice'?'Грань':game==='roulette'?'Сектор':'Сторона'}</legend><div className={'room-choices room-choices-'+game}>{OPTIONS[game].map(([value,label])=><label key={value} className={(choice===value?'selected ':'')+'option-'+value}><input type="radio" name={'choice-'+game} checked={choice===value} onChange={()=>{setChoice(value);setRound(null);setProgress(0);}}/><span>{label}</span></label>)}</div></fieldset>
      {game==='upgrader'&&<p className="demo-explanation">Шанс успеха: {fmt((snapshot.busy&&round?round.chanceFraction:currentRules.chanceFraction)*100)}%</p>}
      {error&&<p className="form-error" role="alert">{error}</p>}<button className="primary" type="submit" disabled={locked}>{snapshot.busy?'Раунд идёт…':game==='upgrader'?'Взломать':'Играть'}</button><p className="demo-explanation">Демонстрационный баланс.</p>
    </form></div>{rules&&<Rules game={game} onClose={()=>setRules(false)}/>}</>;
}
function GameHall() {
  const [adminClient] = useState(()=>createServerAdminClient());
  const [session]=useState(()=>new HallSession(GameMath,undefined,{rtpProfiles:{slots:55,maskhouse:55,lecipher:55}})), snapshot=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  const [game,setGame]=useState(null), [chanceRules,setChanceRules]=useState(false), [resetEpoch,setResetEpoch]=useState(0), [payout,setPayout]=useState(null);
  const {audio,musicEnabled,sfxEnabled,toggleMusic,toggleSfx}=useCasinoAudio(), reduced=useReducedMotion(), profile=useSPWMini({verifyIdentity:SERVER_ADMIN_ENABLED?adminClient.authenticate:null}), mainRef=useRef(null);
  const [adminOpen,setAdminOpen]=useState(false);
  const [lobbyCategory,setLobbyCategory]=useState('all');
  const activeCategory=chanceRules?null:game?['slots','maskhouse','lecipher'].includes(game)?'slots':'classics':lobbyCategory;
  const demoAdminAllowed=canOpenDemoAdmin({embedded:window.parent!==window,url:window.location.href});
  const serverAdminAllowed=SERVER_ADMIN_ENABLED&&profile.verified&&profile.capabilities?.includes('settings:read')&&adminClient.authenticated;
  useEffect(()=>{if(adminOpen==='server'&&!serverAdminAllowed)setAdminOpen(false);},[adminOpen,serverAdminAllowed]);
  const locked=snapshot.busy||!!payout||adminOpen;
  useEffect(()=>{audio?.setMusicMode(game||'hall');},[audio,game]);
  useEffect(()=>{if(audio)applyDemoAudio(audio,session.getSnapshot().presentation);},[audio,session]);
  const applyAdminSettings=useCallback((draft,options)=>applyDemoUiSettings(session,draft,options,audio),[session,audio]);
  const settled=useCallback(round=>{if(round?.game!=='plinko'&&round?.payoutCents>0)setPayout(round);},[]);
  function openGame(next) {if(session.getSnapshot().busy||payout||adminOpen)return;setChanceRules(false);setGame(next);requestAnimationFrame(()=>{mainRef.current?.focus();window.scrollTo({top:0,behavior:reduced?'instant':'smooth'});});}
  function openChanceRules() {if(session.getSnapshot().busy||payout||adminOpen)return;setGame(null);setChanceRules(true);requestAnimationFrame(()=>{mainRef.current?.focus();window.scrollTo({top:0,behavior:'instant'});});}
  function openLobby(category='all') {if(locked)return;setLobbyCategory(category);openGame(null);}
  useSiteTools({session,game,chanceRules,openGame,openChanceRules});
  return <div className="indictus-app app-shell36" data-view={chanceRules?'chance-rules':game||'hall'} data-motion={reduced?'reduced':'full'}><a className="skip-link" href="#hall-content">К играм</a>
    <header className="indictus-header shell14-header"><button className="hall-brand" onClick={()=>openLobby()} disabled={locked} aria-label="MASQ — все игры"><MasqMark/><span className="brand-type"><span className="wordmark">MASQ<span>.</span></span></span></button><nav className="header-nav" aria-label="Навигация"><button className={!game&&!chanceRules?'active':''} aria-current={!game&&!chanceRules?'page':undefined} onClick={()=>openLobby()} disabled={locked}>Все игры</button><button className={chanceRules?'active':''} aria-current={chanceRules?'page':undefined} onClick={openChanceRules} disabled={locked}>Правила шансов</button></nav>
      <div className="shell14-account-tools"><div className="hall-wallet" aria-label="Демонстрационный баланс"><span>Демо-баланс</span><strong>{fmt(snapshot.balance)}<small>АР</small></strong></div><div className="shell14-sound-controls"><button className={'audio-button '+(sfxEnabled?'active':'')} aria-pressed={sfxEnabled} aria-label={sfxEnabled?'Отключить звук':'Включить звук'} onClick={toggleSfx}><MasqIcon name="sound"/></button><button className={'audio-button '+(musicEnabled?'active':'')} aria-pressed={musicEnabled} aria-label={musicEnabled?'Отключить музыку':'Включить музыку'} onClick={toggleMusic}><MasqIcon name="music"/></button></div><span className="shell14-profile"><span className="shell14-avatar" aria-hidden="true"><MasqMark flat/></span><span className="shell14-profile-copy"><span className="profile-name">{profile.user?.username||'Гость'}</span><small>Демо-сеанс</small></span></span></div>{serverAdminAllowed&&<button className="demo-admin-entry" disabled={locked} onClick={()=>setAdminOpen('server')}>Управление</button>}{demoAdminAllowed&&<button className="demo-admin-entry" disabled={locked} onClick={()=>setAdminOpen(true)}>Демо-панель</button>}
    </header>{profile.isEmbedded&&<div className="shell14-connection" role="status"><span>{profile.verified?'Профиль SP Worlds подтверждён':profile.status==='connecting'?'Подключение к SP Worlds…':profile.status==='verifying'?'Проверка профиля…':profile.error||'Профиль получен без серверного подтверждения.'}</span><span>Игры используют демо-фишки.</span></div>}<nav className="shell15-desktop-nav" aria-label="Каталог игр"><div className="shell15-nav-categories">{[['all','Все игры'],['slots','Слоты'],['classics','Классика']].map(([category,label])=><button key={category} className={'shell15-nav-category '+(activeCategory===category?'active':'')} aria-current={activeCategory===category?'page':undefined} disabled={locked} onClick={()=>openLobby(category)}><span className={'shell15-nav-art shell15-nav-art-'+category} aria-hidden="true"><MasqIcon name={category}/></span><span>{label}</span><span className="shell15-nav-arrow" aria-hidden="true">›</span></button>)}</div><button className="shell15-nav-rules" disabled={locked} onClick={openChanceRules}><MasqIcon name="rules"/><span>Правила и шансы</span></button></nav><main id="hall-content" ref={mainRef} tabIndex={-1} className={'indictus-main'+(game==='slots'?' slot-room':'')}>
      {chanceRules?<OddsRules onBack={()=>openGame(null)} rtpProfiles={snapshot.rtpProfiles} classicRtpProfiles={snapshot.classicRtpProfiles} stakeLimits={snapshot.stakeLimits} profileRevision={snapshot.profileRevision}/>:game?<><button className="back-button" disabled={locked} onClick={()=>openGame(null)}>Все игры</button>{(game==='plinko'||game==='blackjack')&&<div className="room-heading"><div><h1>{TITLE[game]}</h1></div></div>}<Suspense fallback={<div className="app-loading" role="status">Открываем игру…</div>}>
        {game==='slots'?<BonanzaSlot key={'slots-'+resetEpoch} session={session} snapshot={snapshot} audio={audio} musicEnabled={musicEnabled} sfxEnabled={sfxEnabled} onMusic={toggleMusic} onSound={toggleSfx} onSettled={settled} payoutOpen={!!payout||adminOpen}/>:game==='maskhouse'||game==='lecipher'?<MaskSlotRoom key={game+'-'+resetEpoch} game={game} session={session} snapshot={snapshot} audio={audio} onSettled={settled} payoutOpen={!!payout||adminOpen}/>:game==='plinko'?<PlinkoRoom key={'plinko-'+resetEpoch} session={session} snapshot={snapshot} audio={audio}/>:game==='blackjack'?<BlackjackRoom key={'blackjack-'+resetEpoch} session={session} snapshot={snapshot} audio={audio} onSettled={settled} payoutOpen={!!payout}/>:<GameRoom key={game+'-'+resetEpoch} game={game} session={session} snapshot={snapshot} reduced={reduced} audio={audio} onSettled={settled} payoutOpen={!!payout}/>}
      </Suspense></>:<LobbyV15 onOpen={openGame} locked={locked} category={lobbyCategory} onCategoryChange={setLobbyCategory}/>}
    </main><footer className="indictus-footer shell14-footer"><div><span>Демо-режим. Реальные платежи не подключены.</span></div><div><button disabled={locked} onClick={openChanceRules}>Правила и шансы</button><button disabled={locked} onClick={()=>{if(session.reset()){setResetEpoch(value=>value+1);setChanceRules(false);setGame(null);setLobbyCategory('all');}}}>Начать заново</button></div></footer>
    <nav className="shell14-mobile-nav" aria-label="Разделы приложения">{[['all','Главная'],['slots','Слоты'],['classics','Классика']].map(([category,label])=><button key={category} className={activeCategory===category?'active':''} aria-current={activeCategory===category?'page':undefined} disabled={locked} onClick={()=>openLobby(category)}><span className={'shell15-nav-art shell15-nav-art-'+category} aria-hidden="true"><MasqIcon name={category}/></span><span>{label}</span></button>)}<button className={chanceRules?'active':''} aria-current={chanceRules?'page':undefined} disabled={locked} onClick={openChanceRules}><MasqIcon name="rules"/><span>Правила</span></button></nav>
    {adminOpen==='server'&&serverAdminAllowed&&<ServerAdminPanel client={adminClient} onClose={()=>setAdminOpen(false)} onSessionExpired={()=>setAdminOpen(false)} getProfileDetails={getProfileDetails}/>}
    {adminOpen===true&&demoAdminAllowed&&<DemoAdminPanel session={session} snapshot={snapshot} onClose={()=>setAdminOpen(false)} onApply={applyAdminSettings} capabilities={DEMO_ADMIN_CAPABILITIES} getProfileDetails={getProfileDetails}/>}
    {payout&&<Suspense fallback={<div className="payout-loading" role="status">Выплата {fmt(payout.payout)} АР</div>}><PayoutScene key={payout.id} round={payout} audio={audio} onClose={()=>setPayout(null)} currency="АР"/></Suspense>}
  </div>;
}

export default function App() {
  return window.location.pathname === '/admin'
    ? <ServerAdminPage getProfileDetails={getProfileDetails}/>
    : <GameHall/>;
}
