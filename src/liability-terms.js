// Current-rule liability quotes. This module never draws RNG or changes payouts.
// A real server must own these imports and pin the whole engine version per round.
import GameMath, { GAME_DEMO_RULES } from './game-math.js';
import { BONANZA_DEMO_RULES } from './bonanza.js';
import { MASK_SLOT_RULES, LEXOF_FEATURE_RULES } from './mask-slots.js';
import { BLACKJACK_RULES, CANDIDATE_RULES } from './blackjack.js';
import { stakeLimits, permittedStake } from './stake-limits.js';
import { SLOT_PROFILE_GAMES, slotProfileSnapshot } from './slot-rtp-profiles.js';
import { CLASSIC_PROFILE_GAMES, classicProfileSnapshot, classicRules } from './classic-rtp-profiles.js';
import {isDemoRtp} from './rtp-range.js';

const integer = (value, name) => {
  if (!Number.isSafeInteger(value) || value < 0) throw new RangeError(`${name} must be nonnegative integer cents.`);
  return value;
};
const multiply = (cents, percent) => integer(Number(BigInt(cents) * BigInt(percent) / 100n), 'Payout');
const empty = value => value === undefined || value === null;
export function liabilityTerms({ game, choice, stake, mode = 'paid', bonusTier, featureMode, rtpProfile, stakeLimits: configuredLimits } = {}) {
  const hardLimits = stakeLimits(game);
  let limits=hardLimits;
  if(!empty(configuredLimits)){
    if(!configuredLimits||typeof configuredLimits!=='object'||Array.isArray(configuredLimits)
      ||Object.keys(configuredLimits).length!==3||!['min','max','step'].every(key=>Object.hasOwn(configuredLimits,key))
      ||!Number.isSafeInteger(configuredLimits.min)||!Number.isSafeInteger(configuredLimits.max)
      ||configuredLimits.step!==hardLimits.step||configuredLimits.min<hardLimits.min||configuredLimits.max>hardLimits.max
      ||configuredLimits.min>configuredLimits.max||configuredLimits.min%hardLimits.step||configuredLimits.max%hardLimits.step)
      throw new RangeError('Configured stake limits must be a published subset of the engine limits.');
    limits=Object.freeze({min:configuredLimits.min,max:configuredLimits.max,step:configuredLimits.step});
  }
  if (!permittedStake(stake, limits)) throw new RangeError('Stake is outside the fixed published limits.');
  if (!['paid', 'buy'].includes(mode)) throw new RangeError('Only paid modes have a financial liability.');
  if (!empty(featureMode) && (game !== 'lecipher' || mode !== 'paid' || !Object.hasOwn(LEXOF_FEATURE_RULES, featureMode)))
    throw new RangeError('Unsupported feature spin mode.');
  const feature = empty(featureMode) ? null : LEXOF_FEATURE_RULES[featureMode];
  if (!empty(rtpProfile)) {
    if(SLOT_PROFILE_GAMES.includes(game)){
      if(!isDemoRtp(rtpProfile))throw new RangeError('Unsupported public slot profile.');
      slotProfileSnapshot(game,rtpProfile,{mode,bonusTier,featureMode});
    }
    else if(CLASSIC_PROFILE_GAMES.includes(game))classicProfileSnapshot(game,rtpProfile,{choice});
    else throw new RangeError('Unsupported public game profile.');
  }
  const stakeCents = integer(stake * 100, 'Stake');
  let chargeMultiplier = 1, maximumPercent, rulesVersion, capOffsetCents = 0;
  let canonicalChoice = choice ?? null, canonicalTier = bonusTier ?? null;
  if (['slots', 'maskhouse', 'lecipher'].includes(game)) {
    if (!empty(choice)) throw new RangeError('Slot rounds have no choice.');
    if (game === 'slots') {
      if (!empty(bonusTier)) throw new RangeError('Bonanza has one bonus offer.');
      rulesVersion = BONANZA_DEMO_RULES.version;
      maximumPercent = BONANZA_DEMO_RULES.winCapMultiplier * 100;
      capOffsetCents = integer(BONANZA_DEMO_RULES.winCapOffsetCents ?? 0, 'Cap offset');
      if (mode === 'buy') chargeMultiplier = BONANZA_DEMO_RULES.bonusBuyMultiplier;
    } else {
      rulesVersion = MASK_SLOT_RULES.version;
      maximumPercent = MASK_SLOT_RULES.winCapMultiplier * 100;
      // A disclosed fixed whole-round offset is part of the cap, not random
      // post-result trimming. Bonanza and other games have no such offset.
      capOffsetCents = integer(MASK_SLOT_RULES.winCapOffsetCents ?? 0, 'Cap offset');
      if (mode === 'buy') {
        canonicalTier = bonusTier ?? (game === 'maskhouse' ? 'sticky' : 'luck');
        const offer = MASK_SLOT_RULES[game].bonusBuys.find(item => item.id === canonicalTier);
        if (!offer) throw new RangeError('This bonus tier cannot be bought.');
        chargeMultiplier = offer.multiplier;
      } else {
        if (!empty(bonusTier)) throw new RangeError('Paid rounds derive their natural bonus tier from the outcome.');
        if (feature) chargeMultiplier = feature.multiplier;
      }
    }
  } else if (game === 'blackjack') {
    if (mode !== 'paid' || !empty(bonusTier) || !empty(choice)) throw new RangeError('Unsupported Blackjack mode.');
    maximumPercent = Math.max(...Object.values(CANDIDATE_RULES.payouts)) * 100;
    rulesVersion = `blackjack-${BLACKJACK_RULES.variant}-${BLACKJACK_RULES.decks}d-${BLACKJACK_RULES.dealerStandsSoft17 ? 's17' : 'h17'}-boost${BLACKJACK_RULES.dealerBoostTickets}of${BLACKJACK_RULES.dealerTicketCount}-player${BLACKJACK_RULES.playerUnfavorableTickets ?? 0}of${BLACKJACK_RULES.playerTicketCount ?? BLACKJACK_RULES.dealerTicketCount}-payout${JSON.stringify(CANDIDATE_RULES.payouts)}`;
    if(!empty(rtpProfile)){
      const spec=classicProfileSnapshot(game,rtpProfile);
      rulesVersion=`${spec.revision}-blackjack-6d-s17-boost${spec.dealerBoostTickets}of${spec.ticketCount}-player${spec.playerUnfavorableTickets}of${spec.ticketCount}-payout${JSON.stringify(spec.payouts)}`;
    }
  } else {
    if (mode !== 'paid' || !empty(bonusTier)) throw new RangeError('This game has no paid bonus purchase.');
    const rules = empty(rtpProfile)?GameMath.rules(game,choice):classicRules(game,choice,rtpProfile); // Validates every game/choice before RNG.
    rulesVersion = GAME_DEMO_RULES.version;
    maximumPercent = Math.round((rules.grossMultiplier ?? Math.max(...rules.multipliers)) * 100);
    if (game === 'plinko') canonicalChoice = 'standard';
  }
  const chargeCents = integer(stakeCents * chargeMultiplier, 'Charge');
  const maxPayoutCents = integer(multiply(stakeCents, maximumPercent) - capOffsetCents, 'Payout cap');
  const profile = empty(rtpProfile) ? null : SLOT_PROFILE_GAMES.includes(game)
    ?slotProfileSnapshot(game,rtpProfile,{mode,bonusTier:canonicalTier,featureMode})
    :classicProfileSnapshot(game,rtpProfile,{choice:canonicalChoice??undefined});
  return Object.freeze({ game, choice: canonicalChoice, stake, stakeCents, mode,
    bonusTier: canonicalTier, ...(feature ? { featureMode: feature.id } : {}), rulesVersion, chargeCents, maxPayoutCents,
    ...(profile ? {rtpProfile:profile.id,profileRules:profile} : {}),
    ...(!empty(configuredLimits)?{stakeLimits:limits}:{}),
    maxHouseLossCents: Math.max(0, maxPayoutCents - chargeCents) });
}

// Exact over the published five-AR grid, including all cent rounding.
// This is an informational quote; only atomic admission can authorize a wager.
export function maximumSafeStake(selection, availableCents, walletCents = Number.MAX_SAFE_INTEGER) {
  integer(availableCents, 'Available reserve'); integer(walletCents, 'Wallet');
  const limits = selection?.stakeLimits ?? stakeLimits(selection?.game);
  liabilityTerms({ ...selection, stake: limits.min }); // Validate even if capacity is zero.
  let maximum = 0;
  for (let stake = limits.min; stake <= limits.max; stake += limits.step) {
    const terms = liabilityTerms({ ...selection, stake });
    if (terms.maxHouseLossCents <= availableCents && terms.chargeCents <= walletCents) maximum = stake;
  }
  return maximum;
}

export const LIABILITY_PROFILES = Object.freeze([
  { game: 'coinflip', choice: 'heads' }, { game: 'dice', choice: 1 },
  { game: 'roulette', choice: 'red' }, { game: 'roulette', choice: 0 },
  { game: 'plinko', choice: 'standard' },
  ...[1.5, 2, 4, 8].map(choice => ({ game: 'upgrader', choice })),
  { game: 'blackjack' }, { game: 'slots' }, { game: 'slots', mode: 'buy' },
  { game: 'maskhouse' }, { game: 'maskhouse', mode: 'buy', bonusTier: 'sticky' },
  { game: 'lecipher' }, { game: 'lecipher', mode: 'buy', bonusTier: 'luck' },
  { game: 'lecipher', mode: 'buy', bonusTier: 'gold' }
].map(Object.freeze));
