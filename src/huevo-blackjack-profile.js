import holdout from '../docs/huevo-blackjack-holdout.json' with {type:'json'};
// Frozen before the independent holdout. Player draws remain uniform; the
// small dealer branch is fixed, published and independent of money/history.
export const HUEVO_BLACKJACK_PROFILE=Object.freeze({id:'rtp97',targetReturnPercent:97,
  dealerBoostTickets:100,playerUnfavorableTickets:0,
  measurements:Object.freeze({source:'Independent actual six-deck engine, huEVO 97 target',
    handsPerStrategy:holdout.hands,seed:holdout.seed,basic_hit_stand:holdout})});
