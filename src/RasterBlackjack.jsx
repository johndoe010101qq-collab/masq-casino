import React from 'react';

const faces = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
const suits = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };
const ease = n => 1 - (1 - Math.max(0, Math.min(1, n))) ** 3;
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

function Card({ card, index, side, motion }) {
  const dealing = motion?.kind === 'deal' && motion.side === side && motion.index === index;
  const progress = dealing ? ease(motion.progress) : 1;
  const turnProgress = Math.max(0, Math.min(1, motion?.progress ?? 0));
  // The visual midpoint matches the presentation's disclosure boundary.
  const flip = motion?.kind === 'flip' && side === 'dealer' && index === 1
    ? turnProgress * turnProgress * (3 - 2 * turnProgress) : card.hidden ? 0 : 1;
  const value = faces[card.rank] ?? String(card.rank ?? '');
  return <div className="bj-card-slot" style={{ transform: `translate(${(1-progress)*130}%,${(1-progress)*-90}%) rotate(${(1-progress)*-14}deg)` }}>
    <div className="bj-card-turn" style={{ transform: `rotateY(${(1-flip)*180}deg)` }}>
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
    </div>
  </div>;
}

export default function RasterBlackjack({ view, motion }) {
  return <div className="blackjack-raster-table">
    <div className="bj-felt-print"><img src="/anonymous-mask-minimal.png" alt=""/><strong>BLACKJACK PAYS 3:2</strong><span>Дилер останавливается на 17</span><small>Включая мягкие 17 · победа 1:1</small></div>
    {['dealer','player'].map(side => <div className={'bj-raster-hand bj-raster-'+side} key={side} style={{'--hand-count':Math.max(2,view[side].length)}}>
      <div className="bj-hand-title"><span>{side==='dealer'?'Дилер':'Вы'}</span><strong>{(side==='dealer'?view.dealerTotal:view.playerTotal) ?? '—'}{side==='dealer' && view.dealer.length>1 && !view.revealed ? ' + ?' : ''}</strong></div>
      <div className="bj-raster-cards" data-long-hand={view[side].length>5} aria-hidden="true">
        {view[side].length ? view[side].map((card,index)=><Card key={side+'-'+index} card={card} side={side} index={index} motion={motion}/>)
          : <span className="bj-empty-hand">Карты появятся здесь</span>}
      </div>
    </div>)}
  </div>;
}
