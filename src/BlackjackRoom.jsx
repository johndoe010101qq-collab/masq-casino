import React, { useEffect, useRef, useState } from 'react';
import { uiStakeLimits, uiBoundedStake, uiPlaybackSpeed } from './demo-ui-settings.js';
import RasterBlackjack from './RasterBlackjack.jsx';
import { BlackjackPresentation } from './blackjack-presentation.js';
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
  const active = useRef(null), mounted = useRef(false), frame = useRef(null), previous = useRef(null);
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
    else active.current.presentation.advance(delta*active.current.speed);
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
      active.current?.presentation.finish(); active.current = null;
    };
  }, [session]);
  useEffect(() => { if (reduced) { stopClock(); startClock(); } }, [reduced]);
  useEffect(()=>{setStake(value=>uiBoundedStake(value,limits));setError('');},[limits.min,limits.max,limits.step]);

  function play() {
    if (active.current || session.getSnapshot().busy || refs.current.payoutOpen) return;
    setError('');
    let hand, record;
    try {
      // Hall admits the worst-case liability, then creates the funded hand.
      // An unavailable RNG releases the local hold before any wallet debit.
      record = session.beginBlackjack(stake);
      hand = record?.hand;
    } catch (failure) { setError(failure.message); return; }
    if (!record) return;
    const presentation = new BlackjackPresentation(hand, {
      transition: (action, current) => session.advanceBlackjack(record.id, action, current),
      publicView: (current, options) => session.blackjackView(record.id, current, options),
      onUpdate: next => { if (mounted.current) setDisplay(next); },
      onCard: () => { if (mounted.current && !document.hidden) safeAudio('fall'); },
      onResolved: finished => {
        const accepted = session.completeBlackjack(record.id, finished);
        active.current = null; stopClock();
        if (accepted && mounted.current) {
          const result = session.getSnapshot().result;
          // The result dialog owns the winning fanfare; card settlement is short.
          safeAudio(result?.payoutCents > 0 ? 'receipt' : 'loss');
          refs.current.onSettled?.(result);
        }
      }
    });
    active.current = { record, presentation, speed:uiPlaybackSpeed(record.presentation) }; presentation.deal(); startClock();
  }
  function action(name) {
    if (refs.current.payoutOpen || !active.current) return;
    try {
      const accepted = active.current.presentation[name]();
      if (accepted) { safeAudio('ui'); startClock(); }
    } catch (failure) { setError(failure.message); }
  }

  const { view } = display;
  const locked = snapshot.busy || payoutOpen;
  return <section className="blackjack-room" aria-label="Blackjack">
    <div className="room-layout">
      <div className={'physical-stage blackjack-stage ' + (display.status === 'resolved' ? 'blackjack-resolved' : '')}>
        <div className="physical-canvas blackjack-physical-canvas"><RasterBlackjack view={view} motion={display.motion} /></div>
        <div className="blackjack-live-status" role="status" aria-live="polite">
          {view.result?.title ?? statuses[display.status]}
        </div>
        <div className="blackjack-actions blackjack-table-actions" role="group" aria-label="Ваш ход">
          <button type="button" disabled={!display.canAct || payoutOpen} onClick={() => action('hit')}>Ещё карту</button>
          <button type="button" disabled={!display.canAct || payoutOpen} onClick={() => action('stand')}>Хватит</button>
        </div>
        <div className="blackjack-accessible-hands">
          <p>Ваши карты: {view.player.map(cardText).join(', ') || 'пока нет'}.</p>
          <p>Карты дилера: {view.dealer.map(cardText).join(', ') || 'пока нет'}.</p>
        </div>
      </div>
      <aside className="room-bet blackjack-bet">
        <label>Ставка <span>{limits.min}–{limits.max} АР</span></label>
        <div className="blackjack-stake-tools" role="group" aria-label="Ставка Blackjack">
          <button type="button" aria-label="Уменьшить ставку" disabled={locked || stake <= limits.min} onClick={() => setStake(n => Math.max(limits.min, n - limits.step))}>−</button>
          <output aria-label="Текущая ставка">{stake} АР</output>
          <button type="button" aria-label="Увеличить ставку" disabled={locked || stake >= limits.max} onClick={() => setStake(n => Math.min(limits.max, n + limits.step))}>+</button>
        </div>
        <button type="button" className="primary blackjack-play" disabled={locked || snapshot.balance < stake} onClick={play}>Новая раздача</button>
        <dl className="blackjack-returns"><div><dt>Blackjack</dt><dd>×2,5</dd></div><div><dt>Победа</dt><dd>×2</dd></div><div><dt>Ничья</dt><dd>×1</dd></div></dl>
        <small>Выплата включает ставку.</small>
        <details className="blackjack-rules"><summary>Правила раздачи</summary><p className="blackjack-rule-copy">Туз — 11 или 1. Дилер останавливается на 17, включая мягкие 17. {snapshot.classicRtpProfiles?.blackjack===98?'Активен вариант с равномерной колодой и добором без возвращения.':'В активном варианте добор игрока и дилера имеет фиксированные неравные вероятности.'} Механизм описан во вкладке «Правила шансов».</p></details>
        <p className="demo-explanation">Демонстрационный баланс.</p>
      </aside>
    </div>
    {error && <p className="error-banner" role="alert">{error}</p>}
  </section>;
}
