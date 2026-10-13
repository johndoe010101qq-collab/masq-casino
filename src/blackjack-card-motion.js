import { BLACKJACK_DEALER_CLIPS, blackjackDealerDealPose, blackjackDealerHandAt,
  blackjackDealerRevealPose } from './blackjack-dealer-clips.js';
import { blackjackTableCardExtraction, blackjackTableCardFlight, blackjackTableCardTurn } from './blackjack-table-projection.js';

const clamp = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const smooth = value => { const p = clamp(value); return p * p * (3 - 2 * p); };

// All phases use the decoded clip's elapsed time. This helper has no timer,
// card rank/suit, outcome, random generator or settlement side effect.
export function blackjackTableCardPresentation(geometry, {
  side = geometry?.side, index = geometry?.index, hidden = false,
  motion = null, reducedMotion = false,
} = {}) {
  const resting = { geometry, visible: true, stage: 'resting', extracted: 1,
    frontVisible: !hidden, faceProgress: hidden ? 0 : 1, lift: 0 };
  if (reducedMotion || !motion) return Object.freeze(resting);
  const time = Number.isFinite(motion.elapsedMs) ? Math.max(0, motion.elapsedMs) : 0;
  if (motion.kind === 'deal' && motion.side === side && motion.index === index) {
    const deal = blackjackDealerDealPose(side, time);
    const pullEnd = deal.takeMs + 180;
    const extracted = smooth((time - deal.takeMs) / (pullEnd - deal.takeMs));
    const hand = blackjackDealerHandAt(`deal_${side}`, Math.min(time, deal.releaseMs), 'L');
    let projected, faceProgress = 0, stage = deal.stage;
    if (time < pullEnd) {
      projected = blackjackTableCardExtraction(geometry, (time - deal.takeMs) / (pullEnd - deal.takeMs), hand);
      stage = time < deal.takeMs ? 'waiting' : 'extracting';
    } else if (time < deal.releaseMs) projected = blackjackTableCardFlight(geometry, 0, { origin: hand, lift: 0 });
    else {
      projected = blackjackTableCardFlight(geometry, deal.flightProgress, { origin: deal.origin, lift: .8 });
      faceProgress = hidden ? 0 : smooth((deal.flightProgress - .2) / .65);
      if (faceProgress > 0 && faceProgress < 1) projected = blackjackTableCardTurn(projected, faceProgress, { lift: .18 });
    }
    return Object.freeze({ geometry: projected, visible: deal.visible,
      stage, extracted, frontVisible: !hidden && faceProgress >= .5,
      faceProgress, lift: Math.sin(Math.PI * faceProgress) });
  }
  if (motion.kind === 'flip' && side === 'dealer' && index === 1) {
    const flip = blackjackDealerRevealPose(time);
    const frontVisible = !hidden && time >= BLACKJACK_DEALER_CLIPS.reveal.marks.reveal.timeMs;
    return Object.freeze({ geometry: blackjackTableCardTurn(geometry, flip.faceProgress),
      visible: true, stage: 'turning', extracted: 1, frontVisible,
      faceProgress: flip.faceProgress, lift: Math.sin(Math.PI * flip.faceProgress) });
  }
  return Object.freeze(resting);
}
