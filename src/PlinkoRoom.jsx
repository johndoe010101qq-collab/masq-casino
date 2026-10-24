import {CURRENCY} from './currency.js';
import React, { useEffect, useRef, useState } from 'react';
import { PLINKO_MULTIPLIERS } from './game-math.js';
import { uiStakeLimits, uiBoundedStake, uiPlaybackSpeed } from './demo-ui-settings.js';
import { PlinkoFlightController } from './plinko-controller.js';
import { useReducedMotion } from './SceneMotion.jsx';
import PlinkoVideoScene from './PlinkoVideoScene.jsx';
import './PlinkoRoom.css';

export default function PlinkoRoom({ session, snapshot, audio }) {
  const limits=uiStakeLimits(snapshot,'plinko');
  const [stake, setStake] = useState(50);
  const [error, setError] = useState('');
  const [boardLayout, setBoardLayout] = useState(null);
  const refs = useRef({ audio });
  refs.current.audio = audio;
  const reduced = useReducedMotion();
  const [controller] = useState(() => new PlinkoFlightController(session, {
    onSound: (cue, options) => { if(cue==='pin')return; try { refs.current.audio?.play(cue, options); } catch {} },
    onError: failure => setError(failure.message),
  }));
  useEffect(() => {
    controller.attach();
    const visibility = () => controller.setVisible(!document.hidden);
    visibility(); document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      controller.detach();
    };
  }, [controller]);
  useEffect(() => { controller.durationMs = (reduced ? 450 : 3800)/uiPlaybackSpeed(snapshot.presentation); }, [controller, reduced,snapshot.presentation]);
  useEffect(()=>{setStake(value=>uiBoundedStake(value,limits));setError('');},[limits.min,limits.max,limits.step]);
  const activeCount = snapshot.pendingGame === 'plinko' ? snapshot.activeCount : 0;
  const locked = !session.canBegin('plinko');
  const play = () => {
    setError('');
    try { controller.launch(stake); } catch (failure) { setError(failure.message); }
  };
  return <section className="room-layout plinko-room" aria-label="Plinko">
    <div className="physical-stage plinko-stage">
      <div className="stage-label"><span>PLINKO</span><small>{activeCount > 0 ? `В полёте: ${activeCount}` : 'Готов к запуску'}</small></div>
      <div className="physical-canvas plinko-canvas">
        <div className="plinko-render"><PlinkoVideoScene controller={controller} reduced={reduced} onLayout={setBoardLayout}
          onPin={()=>{try{refs.current.audio?.play('pin');}catch{}}} /></div>
        {boardLayout && <div className="plinko-bin-labels" role="list" aria-label="Множители лунок слева направо">
          {PLINKO_MULTIPLIERS.map((rate, i) => {
            const anchor=boardLayout.binAnchors?.[i];
            return <span key={i} role="listitem" className={'plinko-bin-label'+(i===0||i===8?' plinko-bin-edge':'')}
              aria-label={`Лунка ${i+1}: множитель ${rate}`}
              style={{left:anchor?.x??boardLayout.width/2+(i-4)*.56*boardLayout.zoom,
                top:anchor?.y??boardLayout.height/2+2.08*boardLayout.zoom,
                '--bin-width':`${anchor?.width??.48*boardLayout.zoom}px`,
                height:`${anchor?.height??.26*boardLayout.zoom}px`,
                fontSize:anchor?`${Math.min(13,Math.max(8,anchor.height*.78))}px`:undefined,
                transform:anchor?'translate(-50%,-50%)':undefined}}>{rate}</span>;
          })}
        </div>}
      </div>
    </div>
    <div className="room-bet plinko-bet">
      <label htmlFor="plinko-stake">Ставка <span>{limits.min}–{limits.max} {CURRENCY}</span></label>
      <div className="plinko-stake-tools" role="group" aria-label="Ставка">
        <button type="button" aria-label="Уменьшить ставку" disabled={locked || stake <= limits.min}
          onClick={() => setStake(value => Math.max(limits.min, value - limits.step))}>−</button>
        <output id="plinko-stake" aria-label="Текущая ставка">{stake} {CURRENCY}</output>
        <button type="button" aria-label="Увеличить ставку" disabled={locked || stake >= limits.max}
          onClick={() => setStake(value => Math.min(limits.max, value + limits.step))}>+</button>
      </div>
      <p className="plinko-limit">Можно запускать несколько шаров подряд.</p>
      <button type="button" className="primary plinko-play" disabled={locked || snapshot.balance < stake}
        onClick={play}>Запустить шар</button>
      {activeCount > 0 && <p className="plinko-flight-status">В полёте: {activeCount}. Можно запускать следующий шар.</p>}
      {error && <p className="error-banner" role="alert">{error}</p>}
      <p className="demo-explanation">{session.remote?(snapshot.mode==='test'?'Тест huEVO. Реальные монэтки не перемещаются.':'Баланс huEVO.'):'Демонстрационный баланс.'}</p>
    </div>
  </section>;
}
