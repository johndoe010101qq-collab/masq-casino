import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve, basename } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createRewardBank, DEFAULT_REWARD_POLICY, REWARD_BANK_POLICY, validateRewardPolicy } from '../server/reward-bank.mjs';

// Synthetic authoritative wager ledger, private temporary SQLite, no browser
// balance, SPWorlds credentials, wallet credit, or external payment request.
let checks = 0;
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message); };
const ok = (actual, message) => { checks++; assert.ok(actual, message); };
const throws = (fn, code) => { checks++; assert.throws(fn, error => error.code === code); };
const directory = mkdtempSync(join(tmpdir(), 'masq-reward-bank-checks-'));
const ledger = new Map(), open = new Set();
let timestamp = 1000, rngCalls = 0, settledSequence = 0;
const now = () => timestamp++;
const authoritative = id => ledger.get(id) ?? null;
function bank(name, options = {}) {
  const value = createRewardBank({ databasePath: join(directory, name + '.sqlite'), readSettledRound: authoritative,
    now, randomInt: maximum => { rngCalls++; return maximum - 1; }, ...options });
  open.add(value); return value;
}
function wager(store, id, accountId, stakeCents, payoutCents = 0, baseStakeCents = stakeCents, sessionKey = 'session-one') {
  ledger.set(id, { id, accountId, sessionKey, settledSequence: ++settledSequence, baseStakeCents, stakeCents, payoutCents });
  return store.recordSettledRound(id);
}
const configuration = store => ({ actorId: 'verified-owner', reason: 'Synthetic server policy check', expectedRevision: store.read().settingsRevision });
try {
  eq(DEFAULT_REWARD_POLICY, { returnPercent: 50, minimumBankCents: 500000, minStakeMultiple: 10, maxStakeMultiple: 30, maxWinners: 5 });
  eq(REWARD_BANK_POLICY.paymentIntegration, 'none');
  for (const patch of [{ returnPercent: -1 }, { returnPercent: 101 }, { returnPercent: 50.5 }, { returnPercent: '50' },
    { minimumBankCents: 0 }, { minimumBankCents: 1.5 }, { minStakeMultiple: 0 }, { minStakeMultiple: 31 },
    { maxStakeMultiple: 101 }, { maxWinners: 0 }, { maxWinners: 101 }, { maxWinners: 1.5 }, { clientProfit: 500000 }])
    throws(() => validateRewardPolicy({ ...DEFAULT_REWARD_POLICY, ...patch }), 'INVALID_POLICY');
  eq(validateRewardPolicy({ maxWinners: 5, maxStakeMultiple: 30, minStakeMultiple: 10, minimumBankCents: 500000, returnPercent: 50 }), DEFAULT_REWARD_POLICY);

  const disconnected = bank('disconnected', { readSettledRound: undefined });
  eq(disconnected.read().authorityConfigured, false);
  eq(disconnected.read().roundCount, 0); eq(disconnected.read().availableBudgetCents, 0);
  throws(() => disconnected.recordSettledRound('client-stake'), 'AUTHORITY_UNCONFIGURED');
  throws(() => disconnected.drawRewards('draw', 'session'), 'AUTHORITY_UNCONFIGURED');
  eq('createDistribution' in disconnected, false, 'No exported manual allocation can bypass the random reward policy.');
  eq(disconnected.configure({ ...DEFAULT_REWARD_POLICY, maxWinners: 3 }, configuration(disconnected)).snapshot.settings.maxWinners, 3);
  eq(disconnected.history().entries[0].kind, 'policy');

  const main = bank('main');
  for (let i = 0; i < 10; i++) wager(main, 'stake-' + i, 'player-' + i, 100000);
  const first = main.read();
  eq(first.roundCount, 10); eq(first.participantCount, 10);
  eq(first.marginCents, 1000000, '10 × 1000 AR completed losing wagers produce 10000 AR margin.');
  eq(first.availableBudgetCents, 500000, '50% creates a 5000 AR reward pool.');
  eq(first.outstandingLiabilityCents, 0);
  eq(main.recordSettledRound('stake-0').recordedNow, false); eq(main.read(), first, 'Retry does not accrue the same margin again.');
  ledger.set('stake-0', { ...ledger.get('stake-0'), payoutCents: 1 });
  throws(() => main.recordSettledRound('stake-0'), 'ROUND_CONFLICT'); eq(main.read(), first);
  ledger.set('stake-0', { ...ledger.get('stake-0'), payoutCents: 0 });
  throws(() => main.recordSettledRound('deposit-not-a-round'), 'ROUND_NOT_SETTLED');
  throws(() => main.recordSettledRound({ id: 'forged', stakeCents: 999999 }), 'INVALID_ID'); eq(main.read(), first);
  for (const bad of [
    { id: 'bad', accountId: 'player-0', stakeCents: 1000, payoutCents: 0 },
    { id: 'bad', accountId: 'player-0', sessionKey: 'session-one', baseStakeCents: 500, stakeCents: 1000, payoutCents: 0, clientReported: true },
  ]) { ledger.set('bad', bad); throws(() => main.recordSettledRound('bad'), 'INVALID_SETTLED_ROUND'); }
  ledger.set('bad', { id: 'different', accountId: 'player-0', sessionKey: 's', settledSequence: ++settledSequence, baseStakeCents: 500, stakeCents: 500, payoutCents: 0 });
  throws(() => main.recordSettledRound('bad'), 'ROUND_ID_MISMATCH');
  ledger.set('bad', { id: 'bad', accountId: 'player-0', sessionKey: 's', settledSequence: ++settledSequence, baseStakeCents: 501, stakeCents: 500, payoutCents: 0 });
  throws(() => main.recordSettledRound('bad'), 'INVALID_BASE_STAKE'); eq(main.read(), first);
  const noPrize = main.drawRewards('expensive-cannot-fit', 'session-one');
  eq(noPrize.status, 'no-affordable-participant'); eq(noPrize.allocations, []);
  eq(noPrize.snapshot.availableBudgetCents, 500000, 'A 1000 AR base wager needs at least a 10000 AR prize; never truncate to 5000.');
  eq(noPrize.createdNow, true);
  eq(main.drawRewards('expensive-cannot-fit', 'session-one').createdNow, false);
  throws(() => main.drawRewards('expensive-cannot-fit', 'different-session'), 'DRAW_CONFLICT');
  const callsAfterSkip = rngCalls;
  eq(main.drawRewards('retry-unaffordable-cohort', 'session-one').status, 'no-affordable-participant');
  eq(rngCalls, callsAfterSkip, 'An unaffordable cohort consumes no RNG and can remain pending.');
  eq(main.drawRewards('forged-session', 'not-an-authoritative-session').status, 'no-eligible-participant');
  eq(main.drawRewards('forged-session', 'not-an-authoritative-session').totalCents, 0);
  wager(main, 'base-for-player-0', 'player-0', 30000, 30000, 30000, 'distribution-session');
  wager(main, 'base-for-player-1', 'player-1', 20000, 20000, 20000, 'distribution-session');
  main.configure({ ...DEFAULT_REWARD_POLICY, minimumBankCents: 1, minStakeMultiple: 10, maxStakeMultiple: 10, maxWinners: 2 }, configuration(main));
  const paidLiability = main.drawRewards('distribution-1', 'distribution-session');
  eq(paidLiability.createdNow, true); eq(paidLiability.snapshot.availableBudgetCents, 0);
  eq(paidLiability.snapshot.outstandingLiabilityCents, 500000); eq(paidLiability.paymentStatus, 'liabilities-only-no-wallet-credit');
  const replay = main.drawRewards('distribution-1', 'distribution-session');
  eq(replay.createdNow, false); eq(replay.snapshot, paidLiability.snapshot, 'Same committed event is idempotent.');
  eq(replay.allocations, paidLiability.allocations);
  throws(() => main.drawRewards('distribution-1', 'wrong-session'), 'DRAW_CONFLICT');
  wager(main, 'competing-new-round', 'player-2', 500, 500, 500, 'competing-session');
  const secondConnection = bank('main');
  eq(secondConnection.drawRewards('competing', 'competing-session').status, 'below-threshold');
  eq(secondConnection.read().allocatedRewardCents, 500000); secondConnection.close(); open.delete(secondConnection);
  wager(main, 'house-loss', 'player-0', 10000, 110000);
  eq(main.read().availableBudgetCents, 0); eq(main.read().entitlementShortfallCents, 50000);
  eq(main.read().outstandingLiabilityCents, 500000, 'Later losses reduce unallocated entitlement and never revoke a committed reward liability.');
  wager(main, 'recover-old-profit', 'player-0', 100000);
  eq(main.read().availableBudgetCents, 0, 'Recovering the old profit peak does not distribute it a second time.');
  wager(main, 'new-profit', 'player-0', 100000);
  eq(main.read().availableBudgetCents, 50000);
  const beforeRestart = main.read(), beforeHistory = main.history(), beforeLiabilities = main.liabilities();
  main.close(); open.delete(main);
  const restarted = bank('main');
  eq(restarted.read(), beforeRestart); eq(restarted.history(), beforeHistory); eq(restarted.liabilities(), beforeLiabilities);
  eq(restarted.drawRewards('distribution-1', 'distribution-session').createdNow, false);
  eq(restarted.liabilities({ accountId: 'player-0' }).entries.length, 1);
  const page = restarted.history({ limit: 2 }); eq(page.entries.length, 2); ok(page.nextCursor);
  ok(restarted.history({ limit: 2, cursor: page.nextCursor }).entries.every(event => event.sequence < page.nextCursor));
  const participantPage = restarted.eligibleAccounts({ limit: 3 }); eq(participantPage.accounts.length, 3); ok(participantPage.nextCursor);
  ok(restarted.eligibleAccounts({ cursor: participantPage.nextCursor }).accounts.every(id => id > participantPage.nextCursor));
  throws(() => restarted.history({ limit: 0 }), 'INVALID_PAGINATION');
  throws(() => restarted.liabilities({ limit: 101 }), 'INVALID_PAGINATION');

  let chooseHighest = true;
  const small = bank('small', { randomInt: maximum => { rngCalls++; return chooseHighest ? maximum - 1 : 0; } });
  wager(small, 'funding', 'outside-player', 1000000, 0, 1000000, 'another-session');
  for (let i = 0; i < 5; i++) wager(small, 'small-' + i, 'small-player-' + i, 25000, 0, 500, 'current-session');
  const draw = small.drawRewards('small-prizes', 'current-session');
  eq(draw.status, 'awarded'); eq(draw.allocations.length, 5); eq(new Set(draw.allocations.map(entry => entry.accountId)).size, 5);
  ok(draw.allocations.every(entry => entry.amountCents >= 5000 && entry.amountCents <= 15000), '5 AR base stake awards 50–150 AR, even when a bought bonus charged 250 AR.');
  eq(draw.totalCents, 75000, 'Five ×30 prizes use base stake, not the complete bonus purchase price.');
  ok(draw.allocations.every(entry => entry.accountId !== 'outside-player'), 'Another session cannot supply this draw recipient.');
  eq(draw.budgetAfterCents, draw.budgetBeforeCents - draw.totalCents);
  ok(draw.budgetAfterCents > 0, 'Unused pool carries forward.');
  const savedDraw = JSON.parse(JSON.stringify(draw));
  const rngAtDraw = rngCalls;
  const replayDraw = small.drawRewards('small-prizes', 'current-session');
  eq(replayDraw.createdNow, false); eq(replayDraw.allocations, savedDraw.allocations); eq(rngCalls, rngAtDraw);
  eq(small.drawRewards('no-new-round', 'current-session').status, 'no-new-settled-round');
  eq(rngCalls, rngAtDraw);
  wager(small, 'small-latest-base', 'small-player-0', 1000, 0, 1000, 'current-session');
  const reducedPolicy = { ...DEFAULT_REWARD_POLICY, minimumBankCents: 1, maxWinners: 1 };
  small.configure(reducedPolicy, configuration(small));
  chooseHighest = false;
  const latestBase = small.drawRewards('last-base-not-old-base', 'current-session');
  eq(latestBase.sampling[0].accountId, 'small-player-0'); eq(latestBase.sampling[0].baseStakeCents, 1000);
  eq(latestBase.sampling[0].multiplier, 10); eq(latestBase.totalCents, 10000); ok(latestBase.totalCents <= latestBase.budgetBeforeCents);

  const restricted = bank('restricted', { randomInt: () => 0 });
  wager(restricted, 'restricted-stake', 'restricted-player', 10000, 0, 300, 'tiny-budget');
  restricted.configure({ ...DEFAULT_REWARD_POLICY, minimumBankCents: 1 }, configuration(restricted));
  const fitted = restricted.drawRewards('restricted-draw', 'tiny-budget');
  eq(fitted.status, 'awarded'); eq(fitted.sampling[0].minimumMultiplier, 10); eq(fitted.sampling[0].maximumMultiplier, 16);
  eq(fitted.totalCents, 3000); eq(fitted.budgetAfterCents, 2000);

  const ordered = bank('ordered', { randomInt: () => 0 });
  ordered.configure({ ...DEFAULT_REWARD_POLICY, minimumBankCents: 1, minStakeMultiple: 10, maxStakeMultiple: 10, maxWinners: 1 }, configuration(ordered));
  ledger.set('ordered-latest', { id: 'ordered-latest', accountId: 'ordered-player', sessionKey: 'ordered-session',
    settledSequence: 200, baseStakeCents: 1000, stakeCents: 1000000, payoutCents: 0 });
  ordered.recordSettledRound('ordered-latest');
  const originalOrderedDraw = ordered.drawRewards('ordered-first', 'ordered-session');
  eq(originalOrderedDraw.totalCents, 10000); eq(originalOrderedDraw.latestSettledSequence, 200);
  ledger.set('ordered-backfill', { id: 'ordered-backfill', accountId: 'ordered-player', sessionKey: 'ordered-session',
    settledSequence: 100, baseStakeCents: 500, stakeCents: 500, payoutCents: 500 });
  ordered.recordSettledRound('ordered-backfill');
  const afterBackfill = ordered.drawRewards('ordered-no-second-gift', 'ordered-session');
  eq(afterBackfill.status, 'no-new-settled-round'); eq(afterBackfill.latestSettledSequence, 200); eq(afterBackfill.totalCents, 0);
  ledger.set('ordered-new-other', { id: 'ordered-new-other', accountId: 'zzz-other-player', sessionKey: 'ordered-session',
    settledSequence: 300, baseStakeCents: 500, stakeCents: 500, payoutCents: 500 });
  ordered.recordSettledRound('ordered-new-other');
  const afterRealNew = ordered.drawRewards('ordered-new-settlement', 'ordered-session');
  eq(afterRealNew.sampling[0].accountId, 'ordered-player'); eq(afterRealNew.sampling[0].baseStakeCents, 1000);
  eq(afterRealNew.sampling[0].sourceSettledSequence, 200); eq(afterRealNew.latestSettledSequence, 300);
  eq(afterRealNew.totalCents, 10000, 'A backfilled older 5 AR stake never replaces the actual latest 10 AR stake.');
  const beforeSequenceConflict = ordered.read();
  ledger.set('ordered-duplicate-sequence', { id: 'ordered-duplicate-sequence', accountId: 'other-player', sessionKey: 'ordered-session',
    settledSequence: 200, baseStakeCents: 500, stakeCents: 500, payoutCents: 0 });
  throws(() => ordered.recordSettledRound('ordered-duplicate-sequence'), 'SETTLEMENT_SEQUENCE_CONFLICT'); eq(ordered.read(), beforeSequenceConflict);
  ledger.set('ordered-latest', { ...ledger.get('ordered-latest'), settledSequence: 201 });
  throws(() => ordered.recordSettledRound('ordered-latest'), 'ROUND_CONFLICT'); eq(ordered.read(), beforeSequenceConflict);
  for (const sequence of [0, -1, 1.5, '1', Number.MAX_SAFE_INTEGER + 1]) {
    ledger.set('ordered-invalid', { ...ledger.get('ordered-latest'), id: 'ordered-invalid', settledSequence: sequence });
    throws(() => ordered.recordSettledRound('ordered-invalid'), 'INVALID_AMOUNT');
  }

  const pending = bank('pending', { randomInt: () => 0 });
  wager(pending, 'pending-low', 'pending-player', 500, 0, 500, 'waiting-session');
  eq(pending.drawRewards('pending-skip', 'waiting-session').status, 'below-threshold');
  wager(pending, 'pending-funding-elsewhere', 'funding-player', 1000000, 0, 1000000, 'other-session');
  const pendingFunded = pending.drawRewards('pending-funded', 'waiting-session');
  eq(pendingFunded.status, 'awarded'); eq(pendingFunded.allocations[0].accountId, 'pending-player');
  eq(pendingFunded.totalCents, 5000, 'A skipped eligible group may receive its first prize after another group funds the global bank.');
  eq(pending.drawRewards('pending-no-repeat', 'waiting-session').status, 'no-new-settled-round');

  const rounding = bank('rounding');
  wager(rounding, 'cent-one', 'cent-player', 1); eq(rounding.read().rewardEntitlementCents, 0);
  wager(rounding, 'cent-two', 'cent-player', 1); eq(rounding.read().rewardEntitlementCents, 1, 'Half-cent shares accumulate before floor rounding.');
  wager(rounding, 'cent-loss', 'cent-player', 1, 4); eq(rounding.read().rewardEntitlementCents, 0); eq(rounding.read().marginCents, -1);
  const policyBefore = rounding.read();
  eq(rounding.configure(DEFAULT_REWARD_POLICY, configuration(rounding)).changed, false); eq(rounding.read(), policyBefore);
  const staleOptions = configuration(rounding);
  rounding.configure({ ...DEFAULT_REWARD_POLICY, returnPercent: 100 }, staleOptions);
  throws(() => rounding.configure(DEFAULT_REWARD_POLICY, staleOptions), 'REVISION_CONFLICT');
  wager(rounding, 'current-share', 'cent-player', 2);
  eq(rounding.read().rewardEntitlementCents, 1, 'Current share applies to cumulative positive settled margin.');
  rounding.configure({ ...DEFAULT_REWARD_POLICY, returnPercent: 0, minimumBankCents: 1 }, configuration(rounding));
  const beforeDisabledRNG = rngCalls; eq(rounding.drawRewards('disabled', 'session-one').status, 'share-disabled'); eq(rngCalls, beforeDisabledRNG);
  eq(rounding.read().availableBudgetCents, 0, 'Zero share recalculates the unallocated bank to zero.');
  const existingLiabilities = restarted.read().outstandingLiabilityCents;
  restarted.configure({ ...DEFAULT_REWARD_POLICY, returnPercent: 0 }, configuration(restarted));
  eq(restarted.read().availableBudgetCents, 0); eq(restarted.read().outstandingLiabilityCents, existingLiabilities);
  wager(restarted, 'loss-while-share-off', 'player-0', 10000, 210000);
  restarted.configure(DEFAULT_REWARD_POLICY, configuration(restarted));
  eq(restarted.read().availableBudgetCents, 0, 'Switching share off during a loss cannot preserve an old profit pool when switched back on.');
  eq(restarted.read().entitlementShortfallCents, 50000);

  const rollback = bank('rollback');
  wager(rollback, 'rollback-one', 'p1', 1000000, 0, 500);
  wager(rollback, 'rollback-two', 'p2', 500);
  const faultDB = new DatabaseSync(join(directory, 'rollback.sqlite'));
  const stable = rollback.read(), stableEvents = rollback.history();
  faultDB.exec("CREATE TRIGGER fail_second_reward BEFORE INSERT ON reward_bank_liabilities WHEN NEW.account_id='p2' BEGIN SELECT RAISE(ABORT,'synthetic second recipient failure'); END;");
  checks++; assert.throws(() => rollback.drawRewards('failed-draw', 'session-one'));
  eq(rollback.read(), stable); eq(rollback.history(), stableEvents); eq(rollback.liabilities().entries, []);
  faultDB.exec('DROP TRIGGER fail_second_reward;');
  const afterFault = rollback.drawRewards('failed-draw', 'session-one'); eq(afterFault.createdNow, true); eq(afterFault.allocations.length, 2);
  const beforePolicyFault = rollback.read();
  faultDB.exec("CREATE TRIGGER fail_policy_audit BEFORE INSERT ON reward_bank_events WHEN NEW.kind='policy' BEGIN SELECT RAISE(ABORT,'synthetic policy audit failure'); END;");
  checks++; assert.throws(() => rollback.configure({ ...DEFAULT_REWARD_POLICY, returnPercent: 60 }, configuration(rollback)));
  eq(rollback.read(), beforePolicyFault, 'Unaudited policy mutation is rolled back.');
  faultDB.exec('DROP TRIGGER fail_policy_audit;');
  const beforeRoundFault = rollback.read();
  faultDB.exec("CREATE TRIGGER fail_round BEFORE INSERT ON reward_bank_rounds BEGIN SELECT RAISE(ABORT,'synthetic authoritative event failure'); END;");
  ledger.set('failed-ingest', { id: 'failed-ingest', accountId: 'p1', sessionKey: 'session-one', settledSequence: ++settledSequence, baseStakeCents: 500, stakeCents: 500, payoutCents: 0 });
  checks++; assert.throws(() => rollback.recordSettledRound('failed-ingest'));
  eq(rollback.read(), beforeRoundFault);
  faultDB.exec('DROP TRIGGER fail_round;'); faultDB.close();
  eq(rollback.recordSettledRound('failed-ingest').recordedNow, true);

  const invalidRng = bank('invalid-rng', { randomInt: maximum => maximum });
  wager(invalidRng, 'invalid-rng-fund', 'rng-player', 1000000, 0, 500);
  const beforeInvalid = invalidRng.read(); throws(() => invalidRng.drawRewards('bad-ticket', 'session-one'), 'INVALID_RNG');
  eq(invalidRng.read(), beforeInvalid); eq(invalidRng.history().entries.length, 1);
  let laterRngCalls = 0;
  const laterInvalidRng = bank('later-invalid-rng', { randomInt: maximum => ++laterRngCalls < 3 ? 0 : maximum });
  wager(laterInvalidRng, 'later-rng-fund', 'later-rng-one', 1000000, 0, 500);
  wager(laterInvalidRng, 'later-rng-two', 'later-rng-two', 500);
  const beforeLaterInvalid = laterInvalidRng.read();
  throws(() => laterInvalidRng.drawRewards('later-bad-ticket', 'session-one'), 'INVALID_RNG');
  eq(laterInvalidRng.read(), beforeLaterInvalid); eq(laterInvalidRng.liabilities().entries, [], 'A later RNG error cannot leave the first planned winner credited.');
  const overflow = bank('overflow');
  wager(overflow, 'max-integer', 'overflow-player', Number.MAX_SAFE_INTEGER);
  const beforeOverflow = overflow.read();
  ledger.set('one-more', { id: 'one-more', accountId: 'overflow-player', sessionKey: 'session-one', settledSequence: ++settledSequence, baseStakeCents: 1, stakeCents: 1, payoutCents: 0 });
  throws(() => overflow.recordSettledRound('one-more'), 'AMOUNT_OVERFLOW'); eq(overflow.read(), beforeOverflow);

  const source = readFileSync(new URL('../server/reward-bank.mjs', import.meta.url), 'utf8');
  ok(!source.includes('fetch(') && !source.includes('HallSession') && !source.includes('/api/'), 'Headless accounting exposes neither financial HTTP routes nor client balance integration.');
  ok(!('creditWallet' in small) && !('pay' in small) && !('withdraw' in small));
  eq(small.liabilities().entries.every(entry => entry.status === 'reserved-uncredited'), true);
  const final = small.read(); small.close(); open.delete(small); throws(() => small.read(), 'BANK_CLOSED');
  const restoredDraws = bank('small'); eq(restoredDraws.read(), final);
  eq(restoredDraws.drawRewards('small-prizes', 'current-session').allocations, savedDraw.allocations);
  console.log(JSON.stringify({ status: 'passed', checks, policy: REWARD_BANK_POLICY.revision, externalRequests: 0, realPayments: 0 }));
} finally {
  for (const store of open) store.close();
  // Delete only the exact temporary directory created by this test.
  if (dirname(resolve(directory)) !== resolve(tmpdir()) || !basename(directory).startsWith('masq-reward-bank-checks-')) throw new Error('Unsafe temporary cleanup path.');
  rmSync(directory, { recursive: true, force: true });
}
