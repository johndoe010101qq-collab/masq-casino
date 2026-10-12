import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { randomInt as cryptoRandomInt } from 'node:crypto';

// Separate reward liabilities. This module never draws a game outcome, changes
// a player wallet, calls a payment API, or accepts browser-reported profit.
export const REWARD_BANK_POLICY = Object.freeze({
  revision: 'masq-settled-margin-reward-bank-v1',
  basis: 'cumulative trusted settled stakes minus cumulative settled payouts',
  rounding: 'floor to whole cents',
  eligibility: 'at least one recorded trusted settled wager',
  recipientSelection: 'uniform distinct eligible accounts in a trusted server session; affordable minimum required',
  paymentIntegration: 'none',
});
export const DEFAULT_REWARD_POLICY = Object.freeze({ returnPercent: 50, minimumBankCents: 500000,
  minStakeMultiple: 10, maxStakeMultiple: 30, maxWinners: 5 });

export class RewardBankError extends Error {
  constructor(code, message) { super(message); this.name = 'RewardBankError'; this.code = code; }
}
const fail = (code, message) => { throw new RewardBankError(code, message); };
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const plain = value => value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value));
function exactKeys(value, keys, code = 'INVALID_REQUEST') {
  if (!plain(value) || Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key)))
    fail(code, 'Unexpected or missing fields.');
}
function identifier(value, name) {
  if (typeof value !== 'string' || !value.length || value.length > 128 || /[\s\u0000-\u001f\u007f]/u.test(value))
    fail('INVALID_ID', `${name} must be a nonempty identifier of at most 128 characters.`);
  return value;
}
function cents(value, name, minimum = 0) {
  if (!Number.isSafeInteger(value) || value < minimum) fail('INVALID_AMOUNT', `${name} must be safe whole cents.`);
  return value;
}
function safe(value, name) {
  if (value < -BigInt(Number.MAX_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER))
    fail('AMOUNT_OVERFLOW', `${name} exceeds the safe ledger range.`);
  return Number(value);
}
export function validateRewardPolicy(value) {
  exactKeys(value, Object.keys(DEFAULT_REWARD_POLICY), 'INVALID_POLICY');
  if (!Number.isSafeInteger(value.returnPercent) || value.returnPercent < 0 || value.returnPercent > 100
    || !Number.isSafeInteger(value.minimumBankCents) || value.minimumBankCents < 1
    || !Number.isSafeInteger(value.minStakeMultiple) || value.minStakeMultiple < 1 || value.minStakeMultiple > 100
    || !Number.isSafeInteger(value.maxStakeMultiple) || value.maxStakeMultiple < value.minStakeMultiple || value.maxStakeMultiple > 100
    || !Number.isSafeInteger(value.maxWinners) || value.maxWinners < 1 || value.maxWinners > 100)
    fail('INVALID_POLICY', 'Share must be 0–100%, minimum bank positive whole cents, multipliers 1–100, recipients 1–100.');
  return freeze(Object.fromEntries(Object.keys(DEFAULT_REWARD_POLICY).map(key => [key, value[key]])));
}
function trustedRound(value, id) {
  if (!value) fail('ROUND_NOT_SETTLED', 'The authoritative ledger has no completed wager with this ID.');
  exactKeys(value, ['id', 'accountId', 'sessionKey', 'settledSequence', 'baseStakeCents', 'stakeCents', 'payoutCents'], 'INVALID_SETTLED_ROUND');
  const result = { id: identifier(value.id, 'Round ID'), accountId: identifier(value.accountId, 'Account ID'),
    sessionKey: identifier(value.sessionKey, 'Trusted session key'), baseStakeCents: cents(value.baseStakeCents, 'Base stake', 1),
    settledSequence: cents(value.settledSequence, 'Authoritative settlement sequence', 1),
    stakeCents: cents(value.stakeCents, 'Full stake payment', 1), payoutCents: cents(value.payoutCents, 'Payout') };
  if (result.baseStakeCents > result.stakeCents) fail('INVALID_BASE_STAKE', 'Base stake cannot exceed the full charged wager.');
  if (result.id !== id) fail('ROUND_ID_MISMATCH', 'The authoritative ledger returned a different round.');
  return freeze(result);
}
function allocationsFor(input) {
  exactKeys(input, ['id', 'allocations']);
  const id = identifier(input.id, 'Distribution ID');
  if (!Array.isArray(input.allocations) || !input.allocations.length || input.allocations.length > 1000)
    fail('INVALID_ALLOCATIONS', 'A distribution must contain between 1 and 1000 recipients.');
  const seen = new Set();
  const allocations = input.allocations.map(value => {
    exactKeys(value, ['accountId', 'amountCents'], 'INVALID_ALLOCATIONS');
    const accountId = identifier(value.accountId, 'Account ID'), amountCents = cents(value.amountCents, 'Reward', 1);
    if (seen.has(accountId)) fail('DUPLICATE_RECIPIENT', 'Each account may occur only once in a distribution.');
    seen.add(accountId); return { accountId, amountCents };
  }).sort((a, b) => a.accountId < b.accountId ? -1 : a.accountId > b.accountId ? 1 : 0);
  const totalCents = safe(allocations.reduce((sum, entry) => sum + BigInt(entry.amountCents), 0n), 'Distribution total');
  return freeze({ id, allocations, totalCents, canonicalJSON: JSON.stringify(allocations) });
}
function pagination(input = {}) {
  if (!plain(input) || Object.keys(input).some(key => !['limit', 'cursor'].includes(key))) fail('INVALID_PAGINATION', 'Invalid pagination.');
  const { limit = 50, cursor } = input;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor < 1))
    fail('INVALID_PAGINATION', 'Limit must be 1–100 and cursor a positive integer.');
  return { limit, cursor };
}

// readSettledRound is a synchronous, server-owned adapter to the authoritative
// wager ledger. It must return only FINAL money rounds, not deposits, previews,
// reward credits, or client claims. Its provenance cannot be inferred from JSON.
// With no adapter the bank can be inspected, but cannot accrue margin.
export function createRewardBank({ databasePath, readSettledRound, randomInt = cryptoRandomInt, now = Date.now } = {}) {
  if (typeof databasePath !== 'string' || !databasePath || databasePath.length > 4096)
    throw new TypeError('An explicit private SQLite database path is required.');
  if (readSettledRound !== undefined && typeof readSettledRound !== 'function') throw new TypeError('A server ledger adapter is required.');
  if (typeof now !== 'function') throw new TypeError('A server clock is required.');
  if (typeof randomInt !== 'function') throw new TypeError('A server integer RNG is required.');
  const target = databasePath === ':memory:' ? databasePath : resolve(databasePath);
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(target);
  let closed = false;
  try {
    db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS reward_bank_state (
        id INTEGER PRIMARY KEY CHECK(id=1), policy_revision TEXT NOT NULL,
        revision INTEGER NOT NULL CHECK(revision>=0), round_count INTEGER NOT NULL CHECK(round_count>=0),
        distribution_count INTEGER NOT NULL CHECK(distribution_count>=0),
        settled_stake_cents INTEGER NOT NULL CHECK(settled_stake_cents>=0),
        settled_payout_cents INTEGER NOT NULL CHECK(settled_payout_cents>=0),
        allocated_reward_cents INTEGER NOT NULL CHECK(allocated_reward_cents>=0),
        settings_revision INTEGER NOT NULL CHECK(settings_revision>0),
        settings_json TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS reward_bank_events (
        sequence INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL CHECK(kind IN ('round','distribution','draw','policy')),
        event_id TEXT NOT NULL, created_at INTEGER NOT NULL CHECK(created_at>=0), payload_json TEXT NOT NULL,
        UNIQUE(kind,event_id)
      );
      CREATE TABLE IF NOT EXISTS reward_bank_rounds (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, session_key TEXT NOT NULL,
        settled_sequence INTEGER UNIQUE NOT NULL CHECK(settled_sequence>0), base_stake_cents INTEGER NOT NULL CHECK(base_stake_cents>0),
        stake_cents INTEGER NOT NULL CHECK(stake_cents>=base_stake_cents),
        payout_cents INTEGER NOT NULL CHECK(payout_cents>=0), created_at INTEGER NOT NULL CHECK(created_at>=0),
        event_sequence INTEGER UNIQUE NOT NULL REFERENCES reward_bank_events(sequence)
      );
      CREATE INDEX IF NOT EXISTS reward_bank_rounds_account ON reward_bank_rounds(account_id);
      CREATE INDEX IF NOT EXISTS reward_bank_rounds_session ON reward_bank_rounds(session_key,account_id,event_sequence);
      CREATE TABLE IF NOT EXISTS reward_bank_distributions (
        id TEXT PRIMARY KEY, total_cents INTEGER NOT NULL CHECK(total_cents>0), allocations_json TEXT NOT NULL,
        created_at INTEGER NOT NULL CHECK(created_at>=0),
        event_sequence INTEGER UNIQUE NOT NULL REFERENCES reward_bank_events(sequence)
      );
      CREATE TABLE IF NOT EXISTS reward_bank_liabilities (
        id INTEGER PRIMARY KEY AUTOINCREMENT, distribution_id TEXT NOT NULL REFERENCES reward_bank_distributions(id),
        account_id TEXT NOT NULL, amount_cents INTEGER NOT NULL CHECK(amount_cents>0),
        created_at INTEGER NOT NULL CHECK(created_at>=0), UNIQUE(distribution_id,account_id)
      );`);
    db.exec(`CREATE TABLE IF NOT EXISTS reward_bank_draws (
      id TEXT PRIMARY KEY, session_key TEXT NOT NULL, latest_settled_sequence INTEGER NOT NULL,
      status TEXT NOT NULL, result_json TEXT NOT NULL, created_at INTEGER NOT NULL CHECK(created_at>=0),
      event_sequence INTEGER UNIQUE NOT NULL REFERENCES reward_bank_events(sequence)
    );`);
    // Earlier development builds could create an empty disconnected schema.
    // Only an EMPTY schema may be upgraded without authoritative history.
    const roundColumns = db.prepare('PRAGMA table_info(reward_bank_rounds)').all().map(row => row.name);
    if (!roundColumns.includes('settled_sequence')) {
      if (db.prepare('SELECT COUNT(*) AS count FROM reward_bank_rounds').get().count)
        fail('SETTLEMENT_ORDER_REQUIRED', 'Existing reward rounds need an explicit authoritative settlement-order migration.');
      db.exec('ALTER TABLE reward_bank_rounds ADD COLUMN settled_sequence INTEGER CHECK(settled_sequence>0);');
    }
    const drawColumns = db.prepare('PRAGMA table_info(reward_bank_draws)').all().map(row => row.name);
    if (!drawColumns.includes('latest_settled_sequence')) {
      if (db.prepare('SELECT COUNT(*) AS count FROM reward_bank_draws').get().count)
        fail('SETTLEMENT_ORDER_REQUIRED', 'Existing draws need an explicit authoritative settlement-order migration.');
      db.exec('ALTER TABLE reward_bank_draws RENAME COLUMN latest_round_sequence TO latest_settled_sequence;');
    }
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS reward_bank_rounds_settlement ON reward_bank_rounds(settled_sequence);
      CREATE INDEX IF NOT EXISTS reward_bank_draws_session ON reward_bank_draws(session_key,latest_settled_sequence);`);
    db.prepare(`INSERT OR IGNORE INTO reward_bank_state(id,policy_revision,revision,round_count,distribution_count,
      settled_stake_cents,settled_payout_cents,allocated_reward_cents,settings_revision,settings_json)
      VALUES(1,?,0,0,0,0,0,0,1,?)`)
      .run(REWARD_BANK_POLICY.revision, JSON.stringify(DEFAULT_REWARD_POLICY));
    if (db.prepare('SELECT policy_revision FROM reward_bank_state WHERE id=1').get()?.policy_revision !== REWARD_BANK_POLICY.revision)
      fail('POLICY_MISMATCH', 'Stored reward policy requires an explicit migration.');
  } catch (error) { db.close(); throw error; }
  const stateQuery = db.prepare(`SELECT reward_bank_state.*,
    (SELECT COUNT(DISTINCT account_id) FROM reward_bank_rounds) AS participant_count FROM reward_bank_state WHERE id=1`);
  const eventQuery = db.prepare('SELECT * FROM reward_bank_events WHERE sequence=?');
  const roundQuery = db.prepare('SELECT * FROM reward_bank_rounds WHERE id=?');
  const settlementQuery = db.prepare('SELECT id FROM reward_bank_rounds WHERE settled_sequence=?');
  const distributionQuery = db.prepare('SELECT * FROM reward_bank_distributions WHERE id=?');
  const drawQuery = db.prepare('SELECT * FROM reward_bank_draws WHERE id=?');
  function ensureOpen() { if (closed) fail('BANK_CLOSED', 'The reward bank is closed.'); }
  function clock() { return cents(now(), 'Server timestamp'); }
  function readState() {
    const value = stateQuery.get();
    if (!value || value.policy_revision !== REWARD_BANK_POLICY.revision) fail('POLICY_MISMATCH', 'Invalid stored reward policy.');
    for (const key of ['revision', 'round_count', 'distribution_count', 'settled_stake_cents', 'settled_payout_cents', 'allocated_reward_cents']) cents(value[key], key);
    cents(value.settings_revision, 'Settings revision', 1);
    validateRewardPolicy(JSON.parse(value.settings_json));
    return value;
  }
  function snapshotFrom(state) {
    const marginCents = safe(BigInt(state.settled_stake_cents) - BigInt(state.settled_payout_cents), 'Settled margin');
    const settings = validateRewardPolicy(JSON.parse(state.settings_json));
    const rewardEntitlementCents = safe(BigInt(Math.max(0, marginCents)) * BigInt(settings.returnPercent) / 100n, 'Reward entitlement');
    const participantCount = cents(state.participant_count, 'Participant count');
    return freeze({ policy: REWARD_BANK_POLICY, authorityConfigured: Boolean(readSettledRound),
      settings, settingsRevision: state.settings_revision,
      revision: state.revision, roundCount: state.round_count, distributionCount: state.distribution_count, participantCount,
      settledStakeCents: state.settled_stake_cents, settledPayoutCents: state.settled_payout_cents, marginCents,
      rewardEntitlementCents, allocatedRewardCents: state.allocated_reward_cents,
      availableBudgetCents: Math.max(0, rewardEntitlementCents - state.allocated_reward_cents),
      entitlementShortfallCents: Math.max(0, state.allocated_reward_cents - rewardEntitlementCents),
      outstandingLiabilityCents: state.allocated_reward_cents,
      marginAfterRewardLiabilitiesCents: safe(BigInt(marginCents) - BigInt(state.allocated_reward_cents), 'Margin after rewards') });
  }
  function read() { ensureOpen(); return snapshotFrom(readState()); }
  function eventFrom(row) {
    return freeze({ sequence: row.sequence, kind: row.kind, id: row.event_id, createdAt: row.created_at,
      ...JSON.parse(row.payload_json) });
  }
  function roundFrom(row) {
    return freeze({ id: row.id, accountId: row.account_id, sessionKey: row.session_key, settledSequence: row.settled_sequence,
      baseStakeCents: row.base_stake_cents, stakeCents: row.stake_cents,
      payoutCents: row.payout_cents, createdAt: row.created_at, eventSequence: row.event_sequence });
  }
  function transaction(run) {
    ensureOpen(); db.exec('BEGIN IMMEDIATE');
    try { const result = run(); db.exec('COMMIT'); return result; }
    catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function updateState(previous, patch) {
    const next = { ...previous, ...patch, revision: safe(BigInt(previous.revision) + 1n, 'Revision') };
    for (const key of ['round_count', 'distribution_count', 'settled_stake_cents', 'settled_payout_cents', 'allocated_reward_cents']) cents(next[key], key);
    db.prepare(`UPDATE reward_bank_state SET revision=?,round_count=?,distribution_count=?,settled_stake_cents=?,
      settled_payout_cents=?,allocated_reward_cents=?,settings_revision=?,settings_json=? WHERE id=1`).run(next.revision, next.round_count,
      next.distribution_count, next.settled_stake_cents, next.settled_payout_cents, next.allocated_reward_cents,
      next.settings_revision, next.settings_json);
    return snapshotFrom(readState());
  }
  function requireAuthority() {
    if (!readSettledRound) fail('AUTHORITY_UNCONFIGURED', 'No authoritative settled-wager ledger is connected.');
  }
  function recordSettledRound(id) {
    ensureOpen(); identifier(id, 'Round ID');
    requireAuthority();
    const round = trustedRound(readSettledRound(id), id);
    return transaction(() => {
      const existing = roundQuery.get(id);
      if (existing) {
        if (existing.account_id !== round.accountId || existing.session_key !== round.sessionKey || existing.settled_sequence !== round.settledSequence
          || existing.base_stake_cents !== round.baseStakeCents
          || existing.stake_cents !== round.stakeCents || existing.payout_cents !== round.payoutCents)
          fail('ROUND_CONFLICT', 'This round ID was already recorded with different money or identity.');
        return freeze({ recordedNow: false, round: roundFrom(existing), event: eventFrom(eventQuery.get(existing.event_sequence)), snapshot: read() });
      }
      if (settlementQuery.get(round.settledSequence)) fail('SETTLEMENT_SEQUENCE_CONFLICT', 'Another recorded round already uses this authoritative settlement sequence.');
      const previous = readState(), createdAt = clock();
      const sequence = Number(db.prepare(`INSERT INTO reward_bank_events(kind,event_id,created_at,payload_json) VALUES('round',?,?,'{}')`)
        .run(id, createdAt).lastInsertRowid);
      cents(sequence, 'Event sequence', 1);
      db.prepare(`INSERT INTO reward_bank_rounds(id,account_id,session_key,settled_sequence,base_stake_cents,stake_cents,payout_cents,created_at,event_sequence)
        VALUES(?,?,?,?,?,?,?,?,?)`).run(id, round.accountId, round.sessionKey, round.settledSequence,
          round.baseStakeCents, round.stakeCents, round.payoutCents, createdAt, sequence);
      const snapshot = updateState(previous, {
        round_count: safe(BigInt(previous.round_count) + 1n, 'Round count'),
        settled_stake_cents: safe(BigInt(previous.settled_stake_cents) + BigInt(round.stakeCents), 'Settled stakes'),
        settled_payout_cents: safe(BigInt(previous.settled_payout_cents) + BigInt(round.payoutCents), 'Settled payouts'),
      });
      const recorded = roundFrom(roundQuery.get(id));
      db.prepare('UPDATE reward_bank_events SET payload_json=? WHERE sequence=?')
        .run(JSON.stringify({ round: recorded, marginDeltaCents: round.stakeCents - round.payoutCents, snapshot }), sequence);
      return freeze({ recordedNow: true, round: recorded, event: eventFrom(eventQuery.get(sequence)), snapshot });
    });
  }
  function insertLiabilities(requested, createdAt, sequence) {
    db.prepare('INSERT INTO reward_bank_distributions VALUES(?,?,?,?,?)')
      .run(requested.id, requested.totalCents, requested.canonicalJSON, createdAt, sequence);
    const insert = db.prepare(`INSERT INTO reward_bank_liabilities(distribution_id,account_id,amount_cents,created_at) VALUES(?,?,?,?)`);
    for (const allocation of requested.allocations) insert.run(requested.id, allocation.accountId, allocation.amountCents, createdAt);
  }
  function configure(value, options) {
    ensureOpen(); const settings = validateRewardPolicy(value);
    exactKeys(options, ['actorId', 'reason', 'expectedRevision']);
    const actorId = identifier(options.actorId, 'Verified administrator ID');
    if (typeof options.reason !== 'string' || !options.reason.trim() || options.reason.length > 500
      || /[\u0000-\u001f\u007f]/u.test(options.reason)) fail('INVALID_REASON', 'A reason of 1–500 characters is required.');
    if (!Number.isSafeInteger(options.expectedRevision) || options.expectedRevision < 1) fail('INVALID_REVISION', 'Current settings revision is required.');
    return transaction(() => {
      const previous = readState();
      if (previous.settings_revision !== options.expectedRevision) fail('REVISION_CONFLICT', 'Reward policy changed; reload the current settings.');
      if (previous.settings_json === JSON.stringify(settings)) return freeze({ changed: false, snapshot: read() });
      const createdAt = clock(), settingsRevision = safe(BigInt(previous.settings_revision) + 1n, 'Settings revision');
      const snapshot = updateState(previous, { settings_revision: settingsRevision, settings_json: JSON.stringify(settings) });
      const sequence = Number(db.prepare(`INSERT INTO reward_bank_events(kind,event_id,created_at,payload_json) VALUES('policy',?,?,?)`)
        .run('settings-' + settingsRevision, createdAt, JSON.stringify({ actorId, reason: options.reason.trim(),
          before: JSON.parse(previous.settings_json), after: settings, settingsRevision, snapshot })).lastInsertRowid);
      cents(sequence, 'Event sequence', 1);
      return freeze({ changed: true, snapshot });
    });
  }
  function drawRewards(eventId, sessionKey) {
    ensureOpen(); requireAuthority(); identifier(eventId, 'Draw event ID'); identifier(sessionKey, 'Trusted session key');
    return transaction(() => {
      const existing = drawQuery.get(eventId);
      if (existing) {
        if (existing.session_key !== sessionKey) fail('DRAW_CONFLICT', 'Draw ID already belongs to a different trusted session.');
        return freeze({ createdNow: false, ...JSON.parse(existing.result_json), snapshot: read() });
      }
      if (distributionQuery.get(eventId)) fail('DRAW_CONFLICT', 'Draw ID was already used for a manual distribution.');
      const previous = readState(), before = snapshotFrom(previous), settings = before.settings;
      const candidates = db.prepare(`SELECT r.account_id,r.base_stake_cents,r.event_sequence,r.settled_sequence FROM reward_bank_rounds r
        JOIN (SELECT account_id,MAX(settled_sequence) AS latest FROM reward_bank_rounds WHERE session_key=? GROUP BY account_id) latest
        ON r.account_id=latest.account_id AND r.settled_sequence=latest.latest ORDER BY r.account_id`).all(sessionKey);
      const latestSettledSequence = candidates.reduce((maximum, row) => Math.max(maximum, row.settled_sequence), 0);
      const lastDrawRound = db.prepare(`SELECT MAX(latest_settled_sequence) AS latest FROM reward_bank_draws WHERE session_key=? AND status='awarded'`).get(sessionKey).latest ?? 0;
      let status = settings.returnPercent === 0 ? 'share-disabled'
        : !candidates.length ? 'no-eligible-participant'
        : latestSettledSequence <= lastDrawRound ? 'no-new-settled-round'
        : before.availableBudgetCents < settings.minimumBankCents ? 'below-threshold' : 'ready';
      const allocations = [], sampling = [];
      let remaining = before.availableBudgetCents, available = [...candidates];
      if (status === 'ready') {
        for (let index = 0; index < settings.maxWinners; index++) {
          const affordable = available.filter(row => BigInt(row.base_stake_cents) * BigInt(settings.minStakeMultiple) <= BigInt(remaining));
          if (!affordable.length) break;
          const winnerIndex = randomInt(affordable.length);
          if (!Number.isSafeInteger(winnerIndex) || winnerIndex < 0 || winnerIndex >= affordable.length) fail('INVALID_RNG', 'Server RNG returned an invalid participant ticket.');
          const winner = affordable[winnerIndex], upper = Math.min(settings.maxStakeMultiple, Number(BigInt(remaining) / BigInt(winner.base_stake_cents)));
          const multiplierTicket = randomInt(upper - settings.minStakeMultiple + 1);
          if (!Number.isSafeInteger(multiplierTicket) || multiplierTicket < 0 || multiplierTicket > upper - settings.minStakeMultiple)
            fail('INVALID_RNG', 'Server RNG returned an invalid multiplier ticket.');
          const multiplier = settings.minStakeMultiple + multiplierTicket;
          const amountCents = safe(BigInt(winner.base_stake_cents) * BigInt(multiplier), 'Prize');
          allocations.push({ accountId: winner.account_id, amountCents });
          sampling.push({ accountId: winner.account_id, baseStakeCents: winner.base_stake_cents, sourceRoundSequence: winner.event_sequence,
            sourceSettledSequence: winner.settled_sequence,
            candidateCount: affordable.length, winnerIndex, minimumMultiplier: settings.minStakeMultiple,
            maximumMultiplier: upper, multiplierTicket, multiplier });
          remaining -= amountCents;
          available = available.filter(row => row.account_id !== winner.account_id);
        }
        status = allocations.length ? 'awarded' : 'no-affordable-participant';
      }
      const totalCents = before.availableBudgetCents - remaining, createdAt = clock();
      const sequence = Number(db.prepare(`INSERT INTO reward_bank_events(kind,event_id,created_at,payload_json) VALUES('draw',?,?,'{}')`)
        .run(eventId, createdAt).lastInsertRowid);
      cents(sequence, 'Event sequence', 1);
      if (allocations.length) insertLiabilities(allocationsFor({ id: eventId, allocations }), createdAt, sequence);
      const snapshot = updateState(previous, allocations.length ? {
        distribution_count: safe(BigInt(previous.distribution_count) + 1n, 'Distribution count'),
        allocated_reward_cents: safe(BigInt(previous.allocated_reward_cents) + BigInt(totalCents), 'Allocated rewards'),
      } : {});
      const result = freeze({ eventId, sessionKey, eventSequence: sequence, createdAt, status, settingsRevision: before.settingsRevision,
        totalCents, allocations, sampling, eligibleCount: candidates.length, latestSettledSequence,
        budgetBeforeCents: before.availableBudgetCents, budgetAfterCents: snapshot.availableBudgetCents,
        paymentStatus: 'liabilities-only-no-wallet-credit' });
      db.prepare('INSERT INTO reward_bank_draws VALUES(?,?,?,?,?,?,?)')
        .run(eventId, sessionKey, latestSettledSequence, status, JSON.stringify(result), createdAt, sequence);
      db.prepare('UPDATE reward_bank_events SET payload_json=? WHERE sequence=?').run(JSON.stringify({ draw: result, snapshot }), sequence);
      return freeze({ createdNow: true, ...result, snapshot });
    });
  }
  function history(input) {
    ensureOpen(); const { limit, cursor } = pagination(input);
    const rows = cursor === undefined
      ? db.prepare('SELECT * FROM reward_bank_events ORDER BY sequence DESC LIMIT ?').all(limit + 1)
      : db.prepare('SELECT * FROM reward_bank_events WHERE sequence<? ORDER BY sequence DESC LIMIT ?').all(cursor, limit + 1);
    const entries = rows.slice(0, limit).map(eventFrom);
    return freeze({ entries, nextCursor: rows.length > limit ? entries.at(-1).sequence : null });
  }
  function liabilities({ accountId, ...page } = {}) {
    ensureOpen(); if (accountId !== undefined) identifier(accountId, 'Account ID');
    const { limit, cursor } = pagination(page), conditions = [], args = [];
    if (accountId !== undefined) { conditions.push('account_id=?'); args.push(accountId); }
    if (cursor !== undefined) { conditions.push('id<?'); args.push(cursor); }
    const rows = db.prepare(`SELECT * FROM reward_bank_liabilities ${conditions.length ? 'WHERE ' + conditions.join(' AND ') : ''} ORDER BY id DESC LIMIT ?`)
      .all(...args, limit + 1);
    const entries = rows.slice(0, limit).map(row => freeze({ id: row.id, distributionId: row.distribution_id,
      accountId: row.account_id, amountCents: row.amount_cents, createdAt: row.created_at, status: 'reserved-uncredited' }));
    return freeze({ entries, nextCursor: rows.length > limit ? entries.at(-1).id : null });
  }
  function eligibleAccounts({ limit = 100, cursor } = {}) {
    ensureOpen();
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) fail('INVALID_PAGINATION', 'Eligible account page size must be 1–1000.');
    if (cursor !== undefined) identifier(cursor, 'Account cursor');
    const rows = cursor === undefined
      ? db.prepare('SELECT DISTINCT account_id FROM reward_bank_rounds ORDER BY account_id LIMIT ?').all(limit + 1)
      : db.prepare('SELECT DISTINCT account_id FROM reward_bank_rounds WHERE account_id>? ORDER BY account_id LIMIT ?').all(cursor, limit + 1);
    const accounts = rows.slice(0, limit).map(row => row.account_id);
    return freeze({ accounts, nextCursor: rows.length > limit ? accounts.at(-1) : null });
  }
  return freeze({ read, snapshot: read, recordSettledRound, configure, drawRewards, history, liabilities, eligibleAccounts,
    close() { if (!closed) { db.close(); closed = true; } } });
}
