import React, { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import AnonymousDealer from './AnonymousDealer.jsx';
import { blackjackCardFlight } from './blackjack-dealer-presentation.js';

const faces = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const pipLayouts = {
  1: [[50,50]], 2: [[50,20],[50,80]], 3: [[50,20],[50,50],[50,80]],
  4: [[25,20],[75,20],[25,80],[75,80]],
  5: [[25,20],[75,20],[50,50],[25,80],[75,80]],
  6: [[25,20],[75,20],[25,50],[75,50],[25,80],[75,80]],
  7: [[25,20],[75,20],[50,35],[25,50],[75,50],[25,80],[75,80]],
  8: [[25,20],[75,20],[50,35],[25,50],[75,50],[50,65],[25,80],[75,80]],
  9: [[25,15],[75,15],[25,38],[75,38],[50,50],[25,62],[75,62],[25,85],[75,85]],
  10: [[25,15],[75,15],[50,27],[25,38],[75,38],[25,62],[75,62],[50,73],[25,85],[75,85]],
};

function Card({ card, index, side, motion, originRef, flightRef, reducedMotion }) {
  const slot = useRef(null);
  const [route, setRoute] = useState(null);
  const dealing = motion?.kind === 'deal' && motion.side === side && motion.index === index;
  const progress = dealing ? motion.progress : 1;
  useLayoutEffect(() => {
    const row = slot.current?.closest('.bj-raster-cards');
    if (!row || row.scrollWidth <= row.clientWidth) return;
    const target = slot.current.getBoundingClientRect(), viewport = row.getBoundingClientRect();
    if (target.right > viewport.right) row.scrollLeft += target.right-viewport.right+10;
  }, [side, index]);
  useLayoutEffect(() => {
    if (!dealing || reducedMotion) return;
    const measure = () => {
      if (!slot.current || !originRef.current || !flightRef.current) return;
      const from = originRef.current.getBoundingClientRect(), to = slot.current.getBoundingClientRect();
      const layer = flightRef.current.getBoundingClientRect();
      const next = { origin:{x:from.left + from.width / 2,y:from.top + from.height / 2},
        target:{x:to.left + to.width / 2,y:to.top + to.height / 2},
        left:to.left-layer.left,top:to.top-layer.top,width:to.width,height:to.height };
      setRoute(current => current && Math.abs(current.origin.x - next.origin.x) < .1 &&
        Math.abs(current.origin.y - next.origin.y) < .1 && Math.abs(current.target.x - next.target.x) < .1 &&
        Math.abs(current.target.y - next.target.y) < .1 && ['left','top','width','height']
          .every(key => Math.abs(current[key]-next[key]) < .1) ? current : next);
    };
    const row = slot.current?.closest('.bj-raster-cards');
    // Flight is portalled above the scroll viewport, so the shoe-to-hand path
    // is not cut off. The separate mount effect also reveals reduced-motion hits.
    measure();
    const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
    if (observer) { observer.observe(slot.current); observer.observe(originRef.current); observer.observe(flightRef.current); }
    row?.addEventListener('scroll', measure, {passive:true});
    window.addEventListener('resize', measure);
    return () => { observer?.disconnect(); row?.removeEventListener('scroll', measure); window.removeEventListener('resize', measure); };
  }, [dealing, reducedMotion, originRef, flightRef]);
  const flight = blackjackCardFlight(route?.origin, route?.target, progress, { reducedMotion });
  const turnProgress = Math.max(0, Math.min(1, motion?.progress ?? 0));
  // The visual midpoint matches the presentation's disclosure boundary.
  const flip = motion?.kind === 'flip' && side === 'dealer' && index === 1
    ? turnProgress * turnProgress * (3 - 2 * turnProgress) : card.hidden ? 0 : 1;
  const value = faces[card.rank] ?? String(card.rank ?? '');
  const face = <div className="bj-card-turn" style={{ transform: `rotateY(${(1-flip)*180}deg)` }}>
      <div className={'bj-card-face ' + (['diamonds','hearts'].includes(card.suit) ? 'bj-card-red' : '')}>
        {!card.hidden && <>
          <span className="bj-card-index"><b>{value}</b><i>{suits[card.suit]}</i></span>
          <span className={'bj-card-pips ' + (card.rank === 1 ? 'bj-card-ace' : card.rank >= 11 ? 'bj-card-court' : '')}>
            {(pipLayouts[card.rank] ?? [[50,50]]).map(([x,y],n) => <i key={n} style={{left:x+'%',top:y+'%',transform:`translate(-50%,-50%) rotate(${y>50?180:0}deg)`}}>{suits[card.suit]}</i>)}
          </span>
          <span className="bj-card-index bj-card-index-bottom"><b>{value}</b><i>{suits[card.suit]}</i></span>
        </>}
      </div>
      <div className="bj-card-back" />
    </div>;
  const flightStyle = {transform:`translate(${flight.x}px,${flight.y}px) rotate(${flight.rotation}deg)`};
  const onTable = dealing && !reducedMotion && route && flightRef.current;
  return <div ref={slot} className="bj-card-slot">
    {onTable ? createPortal(<div className="bj-dealer-flying-card" style={{left:route.left,top:route.top,width:route.width,height:route.height}}>
      <div className="bj-card-flight" style={flightStyle}>{face}</div>
    </div>,flightRef.current) : <div className="bj-card-flight" style={flightStyle}>{face}</div>}
  </div>;
}

export default function RasterBlackjack({ view, motion, status = 'idle', reducedMotion = false, paused = false }) {
  const originRef = useRef(null);
  const flightRef = useRef(null);
  return <div className="blackjack-raster-table">
    <AnonymousDealer display={{view,motion,status}} reducedMotion={reducedMotion} paused={paused} originRef={originRef} />
    <div className="bj-felt-print"><img src="/anonymous-mask-minimal.png" alt=""/><strong>BLACKJACK PAYS 3:2</strong><span>Дилер останавливается на 17</span><small>Включая мягкие 17 · победа 1:1</small></div>
    {['dealer','player'].map(side => <div className={'bj-raster-hand bj-raster-'+side} key={side} style={{'--hand-count':Math.max(2,view[side].length)}}>
      <div className="bj-hand-title"><span>{side==='dealer'?'Дилер':'Вы'}</span><strong>{(side==='dealer'?view.dealerTotal:view.playerTotal) ?? '—'}{side==='dealer' && view.dealer.length>1 && !view.revealed ? ' + ?' : ''}</strong></div>
      <div className="bj-raster-cards" data-long-hand={view[side].length>5} aria-hidden="true">
        {view[side].length ? view[side].map((card,index)=><Card key={side+'-'+index} card={card} side={side} index={index} motion={motion} originRef={originRef} flightRef={flightRef} reducedMotion={reducedMotion}/>)
          : <span className="bj-empty-hand">Карты появятся здесь</span>}
      </div>
    </div>)}
    <div ref={flightRef} className="bj-dealer-flight-layer" aria-hidden="true" />
  </div>;
}
