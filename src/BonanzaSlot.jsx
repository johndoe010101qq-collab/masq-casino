import React, { useEffect, useRef, useState } from 'react';
import { BONANZA_DEMO_RULES } from './bonanza.js';
import { BONANZA_PACE, createBonanzaPlayback, createBonusPurchaseController } from './BonanzaPresentation.js';
import { slotCellPresentation } from './slotCellPresentation.js';
import { getSlotAtlas } from './art/renderSlotAtlas.js';
import {useSlotPlaybackControls} from './useSlotPlaybackControls.js';
import { permittedStake } from './stake-limits.js';
import { validateBonusPurchase } from './hall-session.js';
import { uiStakeLimits, uiBoundedStake, uiPlaybackSpeed } from './demo-ui-settings.js';
import SlotPlaybackOptions from './SlotPlaybackOptions.jsx';
import SlotControls from './SlotControls.jsx';
import { useReducedMotion } from './SceneMotion.jsx';
import './BonanzaSlot.css';
import './BonanzaPace.css';
import './SlotExperience.css';
import BonanzaMascot from './BonanzaMascot.jsx';
import {bonanzaShownPayoutCents} from './bonanza-mascot-presentation.js';
import './BonanzaCommercial.css';


const rules = BONANZA_DEMO_RULES;
const money = value => new Intl.NumberFormat('ru-RU', {maximumFractionDigits:2}).format(value);
const symbolNames = {
  hood:'Капюшон', suit:'Костюм', glove:'Перчатка', laptop:'Ноутбук',
  usb:'USB', lock:'Чип', key:'Шляпа', radio:'Рация', flag:'Флаг',
  scatter:'Маска', bomb:'Множитель'
};
const kinds = Object.keys(rules.pays);
const idleGrid = Array.from({length:6}, (_, column) => Array.from({length:5}, (_, row) => ({
  id:'idle-' + column + '-' + row, kind:kinds[(column * 3 + row * 2) % kinds.length]
})));
const initialVisual = {
  grid:idleGrid, phase:'settled', winningIds:[], removedIds:[],
  scatterIds:[], incomingIds:[], currentPayoutCents:0, totalPayoutCents:0,
  awardedSpins:0, freeSpinIndex:0, bonusPayoutCents:0, multiplier:1,
  payoutGroups:[], cascadePayoutCents:0, spinSummary:null
};
const labelForPhase = {
  deal:'Прокрутка', win:'Совпадение', remove:'Каскад', payout:'Выплата каскада',
  'payout-out':'Выплата каскада', fall:'Новые символы', 'spin-summary':'Итог вращения',
  scatter:'Бонусные маски', 'bonus-intro':'Бесплатные вращения',
  'bonus-summary':'Бонус завершён', 'bonus-payment':'Минимальная выплата бонуса',
  settled:'Готово к вращению'
};

function Sprite({kind, atlas, className = '', label = ''}) {
  const index = atlas.indices[kind];
  return <span className={'slot-sprite ' + className}
    role={label ? 'img' : undefined} aria-label={label || undefined}
    aria-hidden={label ? undefined : 'true'}
    style={{backgroundImage:'url("' + atlas.url + '")',
      backgroundPosition:(index % 4 / 3 * 100) + '% ' + (Math.floor(index / 4) / 2 * 100) + '%'}} />;
}

function trapDialogFocus(event) {
  if (event.key !== 'Tab') return;
  const controls = [...event.currentTarget.querySelectorAll('button,[href],[tabindex],input')]
    .filter(node => !node.disabled && node.tabIndex >= 0 && node.getClientRects().length);
  const first = controls[0], last = controls.at(-1);
  if (!first) {event.preventDefault(); return;}
  if (event.shiftKey && document.activeElement === first) {event.preventDefault(); last.focus();}
  else if (!event.shiftKey && document.activeElement === last) {event.preventDefault(); first.focus();}
}

function useModalDialog(opened, dialog, fallbackFocus) {
  const previous = useRef(null);
  useEffect(() => {
    const node = dialog.current;
    if (opened && !node.open) {
      previous.current = document.activeElement;
      node.showModal();
    } else if (!opened && node.open) {
      node.close();
      const target = previous.current;
      if (target?.isConnected && !target.disabled) target.focus?.();
      else fallbackFocus?.current?.focus?.();
    }
  }, [opened, dialog, fallbackFocus]);
  useEffect(() => () => {if (dialog.current?.open) dialog.current.close();}, [dialog]);
}

function PurchaseDialog({request, cancel, confirm, atlas, fallbackFocus}) {
  const dialog = useRef(null);
  useModalDialog(!!request, dialog, fallbackFocus);
  return <dialog ref={dialog} className="slot-purchase-dialog"
    aria-labelledby="bonus-purchase-title" aria-describedby="bonus-purchase-details"
    onKeyDown={trapDialogFocus} onClose={event => {if (!event.currentTarget.open && request) cancel();}}
    onCancel={event => {event.preventDefault(); cancel();}}>
    {request && <form onSubmit={event => {event.preventDefault(); confirm();}}>
      {atlas && <Sprite kind="scatter" atlas={atlas} className="purchase-mask" />}
      <span className="bonus-eyebrow">Бесплатные вращения</span>
      <h2 id="bonus-purchase-title">Купить бонус?</h2>
      <p id="bonus-purchase-details"><strong>{request.freeSpins}</strong> бесплатных вращений<br />
        Ставка {money(request.stake)} АР</p>
      <strong className="purchase-price">{money(request.cost)} АР</strong>
      <p>Это тот же бонус, который выпадает в обычной игре. Выплаты описаны в «Правилах шансов».</p>
      <div className="purchase-actions">
        <button type="button" className="purchase-cancel" autoFocus onClick={cancel}>Отмена</button>
        <button type="submit" className="purchase-confirm">Купить за {money(request.cost)} АР</button>
      </div>
    </form>}
  </dialog>;
}

function EntranceDialog({opened, continueToGame, atlas, fallbackFocus}) {
  const dialog = useRef(null);
  useModalDialog(opened, dialog, fallbackFocus);
  const maskUrl = atlas?.maskUrl || import.meta.env.BASE_URL + 'indictus-mask.png';
  return <dialog ref={dialog} className="bonanza-entrance-dialog"
    aria-labelledby="bonanza-entrance-title" aria-describedby="bonanza-entrance-copy"
    onClose={event => {if (!event.currentTarget.open && opened) continueToGame();}}
    onCancel={event => {event.preventDefault(); continueToGame();}}
    onKeyDown={event => {
      trapDialogFocus(event);
      if (event.key === 'Enter' || event.key === ' ') {event.preventDefault(); continueToGame();}
    }}>
    <div className="entrance-heading">
      {atlas ? <Sprite kind="scatter" atlas={atlas} className="entrance-mask" /> : <img className="entrance-mask" src={maskUrl} alt="" />}
      <span className="bonanza-eyebrow">MASQ</span>
      <h2 id="bonanza-entrance-title">MASQ Bonanza<span>.</span></h2>
      <p id="bonanza-entrance-copy">Собирай символы и открывай бесплатные вращения.</p>
    </div>
    <div className="entrance-rule-panels">
      <section className="entrance-rule-panel">
        <div className="entrance-rule-art" aria-hidden="true">{atlas && ['hood','glove','usb'].map(kind => <Sprite key={kind} kind={kind} atlas={atlas} />)}</div>
        <strong>Собери 8 символов</strong>
        <p>8 одинаковых символов в любых клетках дают выигрыш. После них на поле падают новые.</p>
      </section>
      <section className="entrance-rule-panel">
        <div className="entrance-rule-art">{atlas ? <Sprite kind="scatter" atlas={atlas} /> : <img src={maskUrl} alt="" />}</div>
        <strong>Поймай 4 маски</strong>
        <p>4 маски дают 10 бесплатных вращений. Ещё 3 маски в бонусе добавляют 5.</p>
      </section>
      <section className="entrance-rule-panel">
        <div className="entrance-rule-art" aria-hidden="true">{atlas && <Sprite kind="bomb" atlas={atlas} />}<b>×2–×25</b></div>
        <strong>Сложи множители</strong>
        <p>В бонусе множители складываются и увеличивают выплату за символы.</p>
      </section>
    </div>
    <button type="button" className="entrance-continue" autoFocus onClick={continueToGame}>Продолжить</button>
    <span className="entrance-key-hint">Enter или пробел</span>
  </dialog>;
}

function RulesDialog({opened, close, atlas, fallbackFocus, limits}) {
  const dialog = useRef(null);
  useModalDialog(opened, dialog, fallbackFocus);
  return <dialog ref={dialog} className="slot-rules-dialog"
    aria-labelledby="bonanza-rules-title" onClose={event => {if (!event.currentTarget.open) close();}} onKeyDown={trapDialogFocus}
    onCancel={event => {event.preventDefault(); close();}}>
    <div className="slot-rules-heading">
      <h2 id="bonanza-rules-title">Правила Bonanza</h2>
      <button type="button" onClick={close} aria-label="Закрыть правила">Закрыть</button>
    </div>
    <p>Поле 6 × 5. Совпадения считаются по всему полю.
      От 8 одинаковых символов — выплата и каскад.</p>
    {[['Обычные вращения',rules.pays],['Бонус: естественный запуск и покупка',rules.freePays]].map(([title,pays]) => <table key={title}><caption>{title}: выплаты от базовой ставки</caption>
      <thead><tr><th>Символ</th><th>8–9</th><th>10–11</th><th>12+</th></tr></thead>
      <tbody>{Object.entries(pays).map(([kind, tiers]) => <tr key={kind}>
        <th scope="row"><span className="slot-rule-symbol">{atlas && <Sprite kind={kind} atlas={atlas} />}
          <span>{symbolNames[kind]}</span></span></th>
        {tiers.map((value, i) => <td key={i}>×{money(value / 100)}</td>)}
      </tr>)}</tbody>
    </table>)}
    <p>Маска — бонусный символ. 4 и больше масок дают 10 бесплатных вращений.
      Во время бонуса 3 и больше масок добавляют ещё 5 вращений.</p>
    <p>Выплата за маски в обычных вращениях: 4 — ×{money(rules.scatterPays[0] / 100)};
      5 — ×{money(rules.scatterPays[1] / 100)}; 6 и больше — ×{money(rules.scatterPays[2] / 100)}.</p>
    <p>В бесплатных вращениях: 4 — ×{money(rules.freeScatterPays[0] / 100)};
      5 — ×{money(rules.freeScatterPays[1] / 100)}; 6 и больше — ×{money(rules.freeScatterPays[2] / 100)}.</p>
    <p>Способ запуска бонуса не меняет выплаты. Та же таблица действует в добавленных вращениях.</p>
    <p>В бонусе появляются множители ×2–×25. Каждый уникальный символ учитывается
      один раз за вращение; значения складываются и умножают выплаты обычных символов.</p>
    <p>Покупка бонуса стоит ×{rules.bonusBuyMultiplier} базовой ставки и даёт
      {rules.initialFreeSpins} начальных вращений. Стоимость списывается один раз.</p>
    <p>Ставки {limits.min}–{limits.max} АР, шаг {limits.step}. Денежные ограничения и реальные вероятности — во вкладке «Правила шансов».</p>
    <p className="slot-rules-demo">Игра на демонстрационных фишках.</p>
    <button type="button" className="slot-rules-dismiss" onClick={close}>Понятно</button>
  </dialog>;
}

export default function BonanzaSlot({
  session, snapshot, audio, musicEnabled = false, sfxEnabled = false,
  onMusic, onSound, onSettled, payoutOpen = false, showAudioControls = false
}) {
  const [stake, setStake] = useState(10);
  const [atlas, setAtlas] = useState(null);
  const [artError, setArtError] = useState('');
  const [error, setError] = useState('');
  const [visual, setVisual] = useState(initialVisual);
  const [outgoingGrid, setOutgoingGrid] = useState(null);
  const [paidGroups, setPaidGroups] = useState([]);
  const shownGrid = useRef(initialVisual.grid);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showRules, setShowRules] = useState(false);
  const [entranceOpen, setEntranceOpen] = useState(true);
  const entrance = useRef(true);
  const [purchase, setPurchase] = useState(null);
  const [purchaseController] = useState(() => createBonusPurchaseController(session));
  const stageFocus = useRef(null);
  const pausedAnimations = useRef([]);
  const playback = useRef(null);
  const mounted = useRef(false);
  const settledCallback = useRef(onSettled);
  const audioRef = useRef(audio);
  settledCallback.current = onSettled;
  audioRef.current = audio;
  const reduced = useReducedMotion();
  const limits=uiStakeLimits(snapshot,'slots');
  useEffect(()=>{setStake(value=>uiBoundedStake(value,limits));setError('');},[limits.min,limits.max,limits.step]);
  const [roundSpeed,setRoundSpeed]=useState(1);
  const controls=useSlotPlaybackControls({busy:snapshot.busy,getBusy:()=>session.getSnapshot().busy,ready:!!atlas,defaultSpeed:uiPlaybackSpeed(snapshot.presentation),modalOpen:entranceOpen||showRules||!!purchase,payoutOpen,canAfford:permittedStake(stake,limits)&&snapshot.balance>=stake,getCanAfford:()=>permittedStake(stake,limits)&&session.getSnapshot().balance>=stake,requestSpin:settings=>start('paid',stake,settings.speed)});
  const locked = Boolean(snapshot.busy || playing || controls.active);
  useEffect(() => { if (reduced) playback.current?.skip(); }, [reduced]);

  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    getSlotAtlas().then(result => {
      if (!cancelled) {setAtlas(result); setArtError('');}
    }).catch(failure => {
      if (!cancelled) setArtError(failure.message);
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      playback.current?.dispose();
      playback.current = null;
      if (purchaseController.current) purchaseController.cancel(purchaseController.current.id);
    };
  }, []);

  function safeAudio(action) {
    try {action(audioRef.current);}
    catch (failure) {console.warn('Indictus audio:', failure);}
  }

  function pauseVisualMotion(hidden) {
    // CSS transitions (survivor gravity/fades) need explicit pause alongside
    // CSS animations so a hidden tab preserves the remaining visible motion.
    if (hidden) {
      pausedAnimations.current = (stageFocus.current?.getAnimations?.({subtree:true}) || [])
        .filter(animation => animation.playState === 'running');
      for (const animation of pausedAnimations.current) animation.pause();
    } else {
      for (const animation of pausedAnimations.current) {
        if (animation.playState === 'paused') animation.play();
      }
      pausedAnimations.current = [];
    }
    if (mounted.current) setPaused(hidden);
  }

  function start(mode, requestedStake = stake, speed=controls.speed) {
    if (entrance.current || !atlas || payoutOpen || showRules || purchaseController.current || playback.current || session.getSnapshot().busy) return false;
    setError('');
    let round;
    try {round = session.begin('slots', 'bonanza', requestedStake, {mode});}
    catch (failure) {setError(failure.message); return false;}
    if (!round) return false;
    playRound(round,speed);return true;
  }

  function openPurchase({stake: requestedStake}) {
    if (entrance.current || !atlas || payoutOpen || showRules || playback.current || session.getSnapshot().busy) return;
    setError('');
    const current=session.getSnapshot(),issue=validateBonusPurchase(requestedStake,current.balance,'slots',undefined,uiStakeLimits(current,'slots'));
    if(issue){setError(issue);return;}
    try {setPurchase(purchaseController.open(requestedStake));}
    catch (failure) {setError(failure.message);}
  }

  function cancelPurchase() {
    if (purchaseController.current) purchaseController.cancel(purchaseController.current.id);
    setPurchase(null);
  }

  function continueToGame() {
    entrance.current = false;
    setEntranceOpen(false);
  }

  function confirmPurchase() {
    const selected = purchaseController.current;
    if (!selected) return;
    try {
      const round = purchaseController.confirm(selected.id);
      setPurchase(null);
      if (round) playRound(round);
    } catch (failure) {
      setPurchase(null);
      setError(failure.message);
    }
  }

  function playRound(round,speed=controls.speed) {
    setPaidGroups([]);
    setRoundSpeed(speed);
    setPlaying(true);
    let finished = false;
    function settle() {
      if (finished) return;
      finished = true;
      playback.current = null;
      const completed = session.complete(round.id);
      safeAudio(player => player?.endRound());
      if (mounted.current) {
        setPlaying(false);
        setPaused(false);
        if (completed) settledCallback.current?.(session.getSnapshot().result);
      }
    }
    try {
      const runner = createBonanzaPlayback(round, {
        speed,
        onVisual:next => {
          if (!mounted.current) return;
          // Keep the previous five symbols behind the incoming strip. Both
          // layers travel the same distance, so a column never flashes empty.
          setOutgoingGrid(next.phase === 'deal' ? shownGrid.current : null);
          shownGrid.current = next.grid;
          if (next.phase === 'deal') setPaidGroups([]);
          else if (next.payoutGroups?.length) setPaidGroups(next.payoutGroups);
          setVisual(next);
        },
        onPause:pauseVisualMotion,
        onCue:(cue, details) => safeAudio(player => {
          if (!player) return;
          if (cue === 'deal') player.beginRound('slots', {durationMs:BONANZA_PACE.deal/speed});
          else if (cue === 'spin-end' || cue === 'bonus-summary') player.endRound();
          else if (cue === 'cascade' || cue === 'bonus' || cue === 'scatter') {
            player.endRound();
            player.play(cue, {tier:details.cascade || 1, durationMs: cue === 'cascade'
              ? (BONANZA_PACE.win + BONANZA_PACE.remove + BONANZA_PACE.payout)/speed : BONANZA_PACE.bonusIntro/speed});
          } else if (cue === 'fall') player.play('fall', {durationMs:BONANZA_PACE.fall/speed});
        }),
        onFinish:settle
      });
      playback.current = runner;
      void runner.start({reducedMotion:reduced}).catch(failure => {
        queueMicrotask(()=>controls.stopAutoplay());
        if (mounted.current) setError('Раунд завершён. Анимацию не удалось показать.');
        console.warn('Indictus presentation:', failure);
      });
    } catch (failure) {
      // A presentation constructor failure still settles the precomputed round.
      queueMicrotask(()=>controls.stopAutoplay());
      settle();
      if (mounted.current) setError('Раунд завершён. Анимацию не удалось показать.');
      console.warn('Indictus presentation:', failure);
    }
  }

  const winning = new Set(visual.winningIds || []);
  const removed = new Set(visual.removedIds || []);
  const activeSpin = visual.isFreeSpin && !['settled','spin-summary','bonus-summary','bonus-intro','scatter'].includes(visual.phase);
  const freeSpinsLeft = Math.max(0, (visual.awardedSpins || 0) - (visual.freeSpinIndex || 0) + (activeSpin ? 1 : 0));
  const payout = bonanzaShownPayoutCents(visual);
  const announcement = visual.bonusAnnouncement;
  const lastPayout = snapshot.result?.game === 'slots' ? snapshot.result.payout : 0;

  return <section className="bonanza-slot raster-slot" aria-label="MASQ Bonanza"
    style={{'--slot-speed':roundSpeed}} data-bonus={visual.isFreeSpin ? 'true' : 'false'}
    data-playback-paused={paused ? 'true' : 'false'} data-reduced={reduced ? 'true' : 'false'}>
    <div className="bonanza-play-layout">
    <div className="bonanza-cabinet" ref={stageFocus} tabIndex={-1}>
    <div className="slot-scene-light" aria-hidden="true"/>
    <BonanzaMascot visual={visual} reducedMotion={reduced}/>
    <header className="bonanza-heading">
      <h2>Bonanza</h2>
    </header>
      <div className="bonanza-status">
        {visual.isFreeSpin && <div className="bonus-spin-counter" aria-live="polite">
          <span>Осталось вращений</span><strong>{freeSpinsLeft}</strong>
        </div>}
      </div>
      <div className="bonanza-field-shell">
        {!atlas ? <div className="bonanza-loading" role="status">
          {artError || 'Загрузка…'}
        </div> : <div className="slot-grid" data-phase={visual.phase}
          role="img" aria-label={'Игровое поле. ' + (labelForPhase[visual.phase] || '')}>
          {visual.phase === 'deal' && outgoingGrid && <div className="slot-outgoing-grid" aria-hidden="true">
            {outgoingGrid.flatMap((columnCells, column) => columnCells.flatMap((cell, row) => cell ?
              <div key={'outgoing-' + cell.id} className="slot-cell is-outgoing"
                style={{'--column':column, '--row':row}}>
                <Sprite kind={cell.kind} atlas={atlas} />
                {cell.kind === 'bomb' && <strong className="slot-bomb-value">×{cell.value}</strong>}
              </div> : []))}
          </div>}
          {visual.grid.flatMap((columnCells, column) => columnCells.flatMap((cell, row) => {
            if (!cell) return [];
            const item = {...cell, column, row};
            const presentation = slotCellPresentation(item, visual);
            const className = ['slot-cell', presentation.incoming && 'is-new',
              presentation.scatterActive && 'scatter-active', winning.has(cell.id) && 'winning',
              removed.has(cell.id) && 'removed'].filter(Boolean).join(' ');
            return <div key={cell.id} className={className} style={presentation.style}>
              <Sprite kind={cell.kind} atlas={atlas} label={removed.has(cell.id) ? '' : symbolNames[cell.kind]} />
              {cell.kind === 'bomb' && !removed.has(cell.id) && <strong className="slot-bomb-value">×{cell.value}</strong>}
            </div>;
          }))}
          {announcement && <div className={'bonanza-announcement ' + (visual.isFreeSpin && !announcement.bought && visual.freeSpinIndex > 0 ? 'bonus-retrigger' : 'bonus-intro')} role="status">
            <Sprite kind="scatter" atlas={atlas} className="bonus-mask" />
            <span className="bonus-eyebrow">{visual.freeSpinIndex > 0 ? 'Ещё бесплатные вращения' : 'Бонус открыт'}</span>
            <strong>{visual.freeSpinIndex > 0 ? '+' : ''}{announcement.added}</strong>
            <span className="bonus-copy">Бесплатных вращений</span>
            <span>{announcement.bought ? 'Стоимость ' + money(announcement.costCents / 100) + ' АР' : 'Удачи!'}</span>
          </div>}
          {visual.phase === 'bonus-summary' && <div className="bonanza-announcement bonus-complete" role="status">
            <Sprite kind="scatter" atlas={atlas} className="bonus-mask" />
            <span className="bonus-eyebrow">Бонус завершён</span><strong>{money(visual.bonusPayoutCents / 100)} <small>АР</small></strong>
            <span className="bonus-copy">Выплата в бесплатных вращениях</span>
            <span>Всего за раунд {money(visual.totalPayoutCents / 100)} АР</span>
          </div>}
          {visual.phase === 'bonus-payment' && visual.bonusPaymentCents > 0 && <div className="bonanza-announcement bonus-minimum-payment" role="status">
            <span className="bonus-eyebrow">Минимальная выплата бонуса</span>
            <strong>+{money(visual.bonusPaymentCents / 100)} <small>АР</small></strong>
            <span className="bonus-copy">Дополнительно начислено</span>
            <span>Итог бонуса — не менее 10% стоимости покупки</span>
          </div>}
        </div>}
      </div>
      <div className="bonanza-readout" aria-live="polite">
        <div className="bonanza-win-total"><span>ВЫИГРЫШ</span><strong>{money(payout / 100)} <small>АР</small></strong></div>
        <div className="bonanza-win-detail">
          {paidGroups.slice(0,3).map(group => <span key={group.id} className="bonanza-win-group"
            data-payout-cents={group.payoutCents}>
            {atlas && group.kind && <Sprite kind={group.kind} atlas={atlas}/>}
            <span>{group.count}<span className="bonanza-group-unit"> шт.</span> · {money(group.payoutCents / 100)} АР</span>
          </span>)}
          {visual.phase === 'spin-summary' && visual.spinSummary?.multiplierWinCents > 0 && <span>
            Множители +{money(visual.spinSummary.multiplierWinCents / 100)} АР
          </span>}
          {visual.phase === 'spin-summary' && visual.spinSummary?.scatterWinCents > 0 && <span>
            Маски +{money(visual.spinSummary.scatterWinCents / 100)} АР
          </span>}
        </div>
      </div>
    </div>
    <SlotControls stake={stake} onStakeChange={setStake} stakeLimits={limits}
      balance={snapshot.balance} lastPayout={lastPayout} currency="АР"
      busy={locked} disabled={controls.active || !atlas || payoutOpen || showRules || !!purchase || entranceOpen}
      skipDisabled={!atlas || payoutOpen || showRules || !!purchase || entranceOpen}
      canSpin={!payoutOpen} canBuyBonus={!payoutOpen}
      buyArtwork={atlas?.maskUrl} buyAtlasUrl={atlas?.url} reducedMotion={reduced}
      soundEnabled={sfxEnabled} musicEnabled={musicEnabled}
      showAudioControls={showAudioControls}
      onSound={onSound} onMusic={onMusic}
      onSpin={() => start('paid')} onBuyBonus={openPurchase}
      onSkip={() => playback.current?.skip()} onInfo={() => setShowRules(true)} /><SlotPlaybackOptions game="slots" controls={controls} disabled={locked||!atlas||payoutOpen||entranceOpen||showRules||!!purchase}/>
    </div>
    {error && <p className="bonanza-error" role="alert">{error}</p>}
    <RulesDialog opened={showRules} close={() => setShowRules(false)} atlas={atlas} fallbackFocus={stageFocus} limits={limits}/>
    <PurchaseDialog request={purchase} cancel={cancelPurchase} confirm={confirmPurchase} atlas={atlas} fallbackFocus={stageFocus} />
    <EntranceDialog opened={entranceOpen} continueToGame={continueToGame} atlas={atlas} fallbackFocus={stageFocus} />
  </section>;
}
