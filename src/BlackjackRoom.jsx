import React, { useEffect, useRef, useState } from 'react';
import { uiStakeLimits, uiBoundedStake } from './demo-ui-settings.js';
import RasterBlackjack from './RasterBlackjack.jsx';
import { BlackjackPresentation } from './blackjack-presentation.js';
import { BLACKJACK_DEALER_PRESENTATION_TIMING, BLACKJACK_DEALER_CLIPS } from './blackjack-dealer-clips.js';
import { advanceBlackjackDealerMedia } from './blackjack-dealer-media-clock.js';
import { useReducedMotion, usePageVisible } from './SceneMotion.jsx';
import './BlackjackRoom.css';

const rank = value => ({ 1: 'Туз', 11: 'Валет', 12: 'Дама', 13: 'Король' }[value] ?? String(value));
const suit = { clubs: 'треф', diamonds: 'бубен', hearts: 'червей', spades: 'пик' };
const cardText = card => card.hidden ? 'Скрытая карта' : `${rank(card.rank)} ${suit[card.suit]}`;
const statuses = { idle: 'Начните новую раздачу', dealing: 'Раздаём карты', player: 'Ваш ход',
  hitting: 'Вы получаете карту', revealing: 'Дилер раскрывает карту', dealer: 'Дилер добирает карты',
  resolving: 'Завершаем раздачу', resolved: 'Раздача завершена' };
const empty = { view: { player: [], dealer: [], playerTotal: null, dealerTotal: null, revealed: false, result: null },
  motion: null, status: 'idle', canAct: false };

export default function BlackjackRoom({ session, snapshot, audio, onSettled, payoutOpen = false }) {
  const limits=uiStakeLimits(snapshot,'blackjack');
  const [stake, setStake] = useState(50), [display, setDisplay] = useState(empty);
  const [error, setError] = useState('');
  const [roundId, setRoundId] = useState('waiting'), [reacting, setReacting] = useState(false);
  const active = useRef(null), mounted = useRef(false), frame = useRef(null), previous = useRef(null);
  const pendingResult = useRef(null), animationDisabled = useRef(false);
  const refs = useRef({ audio, onSettled, payoutOpen }); refs.current = { audio, onSettled, payoutOpen };
  const reduced = useReducedMotion(), pageVisible = usePageVisible();
  const reduceRef = useRef(reduced); reduceRef.current = reduced;
  const safeAudio = cue => { try { refs.current.audio?.play(cue); } catch (failure) { console.warn('Indictus audio', failure); } };
  const stopClock = () => { if (frame.current !== null) cancelAnimationFrame(frame.current); frame.current = null; previous.current = null; };
  function tick(now) {
    frame.current = null;
    if (!mounted.current || !active.current || document.hidden) { previous.current = null; return; }
    const delta = previous.current === null ? 0 : Math.max(0, now - previous.current); previous.current = now;
    if (reduceRef.current) active.current.presentation.flushTransitions();
    else {
      const current = active.current;
      const motion = current.presentation.motion;
      // Deal/flip timing follows the decoded dealer frame. Only result delay,
      // disabled animation or failed video uses the fallback presentation clock.
      if (['deal','flip'].includes(motion?.kind) && !animationDisabled.current && current.failedStep !== motion.stepId) return;
      current.presentation.advance(delta);
    }
    if (active.current?.presentation.step) frame.current = requestAnimationFrame(tick);
  }
  function startClock() {
    if (reduceRef.current) active.current?.presentation.flushTransitions();
    if (frame.current === null && !document.hidden && active.current?.presentation.step) {
      previous.current = null; frame.current = requestAnimationFrame(tick);
    }
  }
  useEffect(() => {
    mounted.current = true;
    const visibility = () => { stopClock(); if (!document.hidden) startClock(); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false; stopClock(); document.removeEventListener('visibilitychange', visibility);
      // Once-only terminal settlement also applies if the room is removed during
      // a deal/hit/flip. No stale opening balance is restored.
      active.current?.presentation.finish(); active.current = null; pendingResult.current = null;
    };
  }, [session]);
  useEffect(() => { if (reduced) { stopClock(); startClock(); if(pendingResult.current) finishReaction(pendingResult.current.token); } }, [reduced]);
  useEffect(()=>{setStake(value=>uiBoundedStake(value,limits));setError('');},[limits.min,limits.max,limits.step]);

  function finishReaction(token) {
    const pending = pendingResult.current;
    if (!pending || pending.token !== token) return;
    pendingResult.current = null;
    if (mounted.current) { setReacting(false); refs.current.onSettled?.(pending.result); }
  }
  function mediaProgress(timeSeconds, token, clip, ended = false) {
    const current = active.current, motion = current?.presentation.motion;
    if (current && motion && token === `${current.record.id}:${motion.stepId}` && current.failedStep !== motion.stepId && !animationDisabled.current) {
      const release = BLACKJACK_DEALER_CLIPS[clip]?.marks.release?.timeMs;
      if (release !== undefined && timeSeconds * 1000 >= release && current.cardSoundStep !== motion.stepId && !document.hidden) {
        current.cardSoundStep = motion.stepId; safeAudio('fall');
      }
      advanceBlackjackDealerMedia(current.presentation, motion.stepId, timeSeconds * 1000, ended);
      startClock();
    }
    const pending = pendingResult.current;
    const peak = BLACKJACK_DEALER_CLIPS.lose_laugh.marks.chuckle_peak.timeMs;
    if (pending?.token === token && clip === 'lose_laugh' && !pending.chuckled && timeSeconds * 1000 >= peak && !document.hidden) {
      pending.chuckled = true; safeAudio('dealerChuckle');
    }
  }
  function mediaEnded(token, clip) {
    mediaProgress(BLACKJACK_DEALER_CLIPS[clip]?.durationMs / 1000, token, clip, true);
    finishReaction(token);
  }
  function mediaError(token) {
    const current = active.current, motion = current?.presentation.motion;
    if (current && motion && token === `${current.record.id}:${motion.stepId}`) {
      current.failedStep = motion.stepId; startClock();
    }
    finishReaction(token);
  }
  function animationMode(disabled) {
    animationDisabled.current = disabled;
    const current = active.current;
    if (disabled && current?.presentation.motion) current.failedStep = current.presentation.motion.stepId;
    if (disabled && pendingResult.current) finishReaction(pendingResult.current.token);
    startClock();
  }

  function play() {
    if (active.current || pendingResult.current || session.getSnapshot().busy || refs.current.payoutOpen) return;
    setError('');
    let hand, record;
    try {
      // Hall admits the worst-case liability, then creates the funded hand.
      // An unavailable RNG releases the local hold before any wallet debit.
      record = session.beginBlackjack(stake);
      hand = record?.hand;
    } catch (failure) { setError(failure.message); return; }
    if (!record) return;
    setRoundId(record.id);
    const presentation = new BlackjackPresentation(hand, {
      timing: BLACKJACK_DEALER_PRESENTATION_TIMING,
      transition: (action, current) => session.advanceBlackjack(record.id, action, current),
      publicView: (current, options) => session.blackjackView(record.id, current, options),
      onUpdate: next => { if (mounted.current) setDisplay(next); },
      onCard: () => {},
      onResolved: finished => {
        const accepted = session.completeBlackjack(record.id, finished);
        active.current = null; stopClock();
        if (accepted && mounted.current) {
          const result = session.getSnapshot().result;
          // The result dialog owns the winning fanfare; card settlement is short.
          safeAudio(result?.payoutCents > 0 ? 'receipt' : 'loss');
          if (reduceRef.current || animationDisabled.current) refs.current.onSettled?.(result);
          else {
            pendingResult.current = { token: `${record.id}:result`, result, chuckled: false };
            setReacting(true);
          }
        }
      }
    });
    active.current = { record, presentation, failedStep: null }; presentation.deal(); startClock();
  }
  function action(name) {
    if (refs.current.payoutOpen || !active.current) return;
    try {
      const accepted = active.current.presentation[name]();
      if (accepted) { safeAudio('ui'); startClock(); }
    } catch (failure) { setError(failure.message); }
  }

  const { view } = display;
  const locked = snapshot.busy || payoutOpen || reacting;
  return <section className="blackjack-room" aria-label="Blackjack">
    <div className="room-layout">
      <div id="bj-live-stage" className={'physical-stage blackjack-stage bj-video-stage ' + (display.status === 'resolved' ? 'blackjack-resolved' : '')}>
        <RasterBlackjack view={view} motion={display.motion}
          roundId={roundId} reacting={reacting} onVideoProgress={mediaProgress} onVideoEnded={mediaEnded} onVideoError={mediaError}
          onAnimationModeChange={animationMode} status={display.status} reducedMotion={reduced} paused={!pageVisible || payoutOpen} />
        <div className="bj-live-table-footer">
          <div className="bj-console-heading">
            <div className="blackjack-live-status" data-phase={display.status} role="status" aria-live="polite">
              <span className="bj-status-light" aria-hidden="true" />{view.result?.title ?? statuses[display.status]}
            </div>
            <span className="bj-table-limit">{limits.min}–{limits.max} АР</span>
          </div>
          <div className="bj-console-controls">
            <div className="bj-console-stake">
              <span className="bj-console-label">Ставка</span>
              <div className="blackjack-stake-tools" role="group" aria-label="Ставка Blackjack">
                <button type="button" aria-label="Уменьшить ставку" disabled={locked || stake <= limits.min} onClick={() => setStake(n => Math.max(limits.min, n - limits.step))}>−</button>
                <output aria-label="Текущая ставка">{stake}<span>АР</span></output>
                <button type="button" aria-label="Увеличить ставку" disabled={locked || stake >= limits.max} onClick={() => setStake(n => Math.min(limits.max, n + limits.step))}>+</button>
              </div>
            </div>
            <div className="blackjack-actions blackjack-table-actions" role="group" aria-label="Управление раздачей">
              <button type="button" className="blackjack-play" disabled={locked || snapshot.balance < stake} onClick={play}>Новая раздача</button>
              <button type="button" disabled={!display.canAct || payoutOpen} onClick={() => action('hit')}><span className="bj-action-symbol" aria-hidden="true">+</span>Ещё карту</button>
              <button type="button" disabled={!display.canAct || payoutOpen} onClick={() => action('stand')}><span className="bj-action-symbol" aria-hidden="true">−</span>Хватит</button>
            </div>
          </div>
          <div className="bj-console-information">
            <dl className="blackjack-returns"><div><dt>Blackjack</dt><dd>×2,5</dd></div><div><dt>Победа</dt><dd>×2</dd></div><div><dt>Ничья</dt><dd>×1</dd></div></dl>
            <details className="blackjack-rules"><summary>Правила раздачи</summary><p className="blackjack-rule-copy">Blackjack — ×2,5. Победа — ×2, ничья — ×1. Выплата включает ставку. Туз — 11 или 1. Дилер останавливается на 17, включая мягкие 17. {snapshot.classicRtpProfiles?.blackjack===98?'Активен вариант с равномерной колодой и добором без возвращения.':'В активном варианте добор игрока и дилера имеет фиксированные неравные вероятности.'} Механизм описан во вкладке «Правила шансов».</p></details>
            <span className="bj-demo-note">Демо-баланс</span>
          </div>
        </div>
        <div className="blackjack-accessible-hands">
          <p>Ваши карты: {view.player.map(cardText).join(', ') || 'пока нет'}.</p>
          <p>Карты дилера: {view.dealer.map(cardText).join(', ') || 'пока нет'}.</p>
        </div>
      </div>
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}
  </section>;
}
