import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import BlackjackDealerVideo from './BlackjackDealerVideo.jsx';
import { BLACKJACK_TABLE_SCENE, blackjackTableHand, blackjackTableCardFlight } from './blackjack-table-projection.js';
import { selectBlackjackDealerClip, blackjackDealerDealPose, blackjackDealerRevealPose } from './blackjack-dealer-clips.js';
import './BlackjackPerspectiveTable.css';

const faces = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const smooth = n => { const p = Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0)); return p*p*(3-2*p); };

function FeltCard({ card, geometry, side, index, motion, reducedMotion }) {
  const dealing = motion?.kind === 'deal' && motion.side === side && motion.index === index;
  const dealPose = dealing && !reducedMotion ? blackjackDealerDealPose(side, motion.elapsedMs) : null;
  const pose = dealPose ? blackjackTableCardFlight(geometry, dealPose.flightProgress, { origin: dealPose.origin, lift: dealPose.stage === 'carried' ? 0 : 1.5 }) : geometry;
  const revealing = motion?.kind === 'flip' && side === 'dealer' && index === 1;
  const faceProgress = revealing && !reducedMotion ? blackjackDealerRevealPose(motion.elapsedMs).faceProgress : card.hidden ? 0 : dealPose?.stage === 'carried' ? 0 : dealPose?.stage === 'flying' ? smooth(dealPose.flightProgress*2) : 1;
  // A hidden public card contributes no rank, suit or face content to the DOM.
  const value = card.hidden ? '' : (faces[card.rank] ?? String(card.rank ?? ''));
  const suit = card.hidden ? '' : (suits[card.suit] ?? '');
  const red = !card.hidden && ['diamonds','hearts'].includes(card.suit);
  return <div className="bj-felt-card" data-side={side} data-card-index={index}
    data-hidden={Boolean(card.hidden)} data-dealing={dealing}
    data-flight-stage={dealPose?.stage??'resting'}
    style={{width:geometry.rect.width,height:geometry.rect.height,transform:pose.cssTransform,zIndex:dealing?60:index+1,visibility:dealPose&&!dealPose.visible?'hidden':'visible'}}>
    <div className="bj-felt-card-turn" style={{transform:`rotateY(${(1-faceProgress)*180}deg)`}}>
      <div className={'bj-felt-card-face'+(red?' bj-felt-card-red':'')}>
        {!card.hidden && <>
          <span className="bj-felt-card-corner"><b>{value}</b><i>{suit}</i></span>
          <span className="bj-felt-card-suit">{suit}</span>
          <span className="bj-felt-card-corner bj-felt-card-corner-bottom"><b>{value}</b><i>{suit}</i></span>
        </>}
      </div>
      <div className="bj-felt-card-back" />
    </div>
  </div>;
}

export default function RasterBlackjack({ view, motion, roundId = 'waiting', reacting = false, onVideoProgress, onVideoEnded, onVideoError, onAnimationModeChange, status = 'idle', reducedMotion = false, paused = false }) {
  const viewport = useRef(null);
  const [scale, setScale] = useState(1);
  const [backgroundPaused, setBackgroundPaused] = useState(false);
  const modeCallback = useRef(onAnimationModeChange); modeCallback.current = onAnimationModeChange;
  useEffect(()=>{modeCallback.current?.(backgroundPaused||reducedMotion);},[backgroundPaused,reducedMotion]);
  const clip = status === 'resolved' && !reacting ? 'idle' : selectBlackjackDealerClip({view,motion,status});
  const token = clip === 'idle' ? `${roundId}:idle` : status === 'resolved' ? `${roundId}:result` : `${roundId}:${motion?.stepId}`;
  useLayoutEffect(() => {
    const node = viewport.current;
    if (!node) return;
    const measure = () => {
      const box = node.getBoundingClientRect();
      const next = Math.max(box.width/1920,box.height/1080);
      if (next > 0 && Number.isFinite(next)) setScale(value => Math.abs(value-next)<.00001?value:next);
    };
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    window.addEventListener('resize',measure);
    return () => {observer?.disconnect();window.removeEventListener('resize',measure);};
  }, []);
  return <div ref={viewport} className="blackjack-live-table" data-projection="felt"
    data-scene-width={BLACKJACK_TABLE_SCENE.width} data-scene-height={BLACKJACK_TABLE_SCENE.height}
    data-scene-scale={scale} data-phase={status} data-reduced-motion={reducedMotion}>
    <div className="bj-live-plane" aria-hidden="true"
      style={{width:1920,height:1080,transform:`translate(-50%,-50%) scale(${scale})`}}>
      <BlackjackDealerVideo action={{clip,token}} paused={paused||backgroundPaused} reducedMotion={reducedMotion}
        onProgress={onVideoProgress} onEnded={onVideoEnded} onError={onVideoError} />
      {['dealer','player'].flatMap(side => {
        const geometry=blackjackTableHand(side,view[side].length);
        return view[side].map((card,index)=><FeltCard key={side+'-'+index} card={card} geometry={geometry[index]}
          side={side} index={index} motion={motion} reducedMotion={reducedMotion} />);
      })}
    </div>
    <div className="bj-live-scores">
      <div><span>Дилер</span><strong>{view.dealerTotal??'—'}{view.dealer.length>1&&!view.revealed?' + ?':''}</strong></div>
      <div><span>Вы</span><strong>{view.playerTotal??'—'}</strong></div>
    </div>
    {!reducedMotion && <button type="button" className="bj-live-motion-toggle"
      aria-pressed={backgroundPaused} onClick={()=>setBackgroundPaused(value=>!value)}>
      {backgroundPaused?'Включить фон':'Пауза фона'}
    </button>}
  </div>;
}
