import {playUniversalSlotRound as playCalibratedSlotRound} from './universal-slot-profiles.js';
import {stakeLimits,permittedStake} from './stake-limits.js';

// Published site/API stake validation before any RNG. The calibrated sampler
// remains a separate sealed source; valid input and its RNG stream pass through
// unchanged. This wrapper has no balance, player or previous-round arguments.
export function playUniversalSlotRound(input={}) {
 if(!input||typeof input!=='object'||Array.isArray(input))throw new TypeError('A public slot request is required.');
 if(!['slots','maskhouse','lecipher'].includes(input.game))throw new RangeError('Unsupported public slot.');
 if(!Number.isSafeInteger(input.stakeCents)||!permittedStake(input.stakeCents/100,stakeLimits(input.game)))
  throw new RangeError('Stake must fit the published whole-AR limits and five-AR step.');
 return playCalibratedSlotRound(input);
}
