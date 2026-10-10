import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { request as httpRequest } from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { checkUser } from 'spwmini/middleware';
import { createAdminAuth, CLAIM_MAX_AGE_MS, CLAIM_FUTURE_SKEW_MS, SESSION_TTL_MS } from '../server/admin-auth.mjs';
import { createAdminStore } from '../server/admin-store.mjs';
import { createAdminServer, MAX_JSON_BYTES } from '../server/admin-server.mjs';
import { ADMIN_DEFAULTS } from '../src/demo-admin-controls.js';

// Synthetic server-boundary checks. No real platform token, owner account,
// wallet, payment, public hosting or external request is used here.
let checks = 0;
const eq = (actual, expected, message) => { checks++; assert.deepEqual(actual, expected, message); };
const ok = (value, message) => { checks++; assert.ok(value, message); };
const throwsCode = (fn, code) => { checks++; assert.throws(fn, error => error.code === code); };
const clone = value => JSON.parse(JSON.stringify(value));
const testDirectory = mkdtempSync(join(tmpdir(), 'masq-admin-checks-'));
const tokenSecret = 'synthetic-test-application-secret';
let timestamp = Date.UTC(2026, 9, 10, 12);
const now = () => timestamp;
const ownerEnv = { SPW_APP_TOKEN: tokenSecret, MASQ_OWNER_ACCOUNT_IDS: 'owner-account-1,owner-account-2', SPW_TIMESTAMP_UNIT: 'milliseconds' };
const origin = 'http://127.0.0.1:5178';

function signedClaim(patch = {}, secret = tokenSecret) {
  const user = { accountId: 'owner-account-1', username: 'deathlain', minecraftUUID: '11111111-1111-1111-1111-111111111111',
    timestamp: now(), roles: [], isAdmin: false, ...patch };
  delete user.hash;
  const checkString = Object.keys(user).sort().filter(key => user[key] && key !== 'hash').map(key => `${key}=${user[key]}`).join('\n');
  return { ...user, hash: createHmac('sha256', createHash('sha256').update(secret).digest()).update(checkString).digest('hex') };
}

let application;
try {
  const sample = signedClaim();
  eq(checkUser(sample, tokenSecret), true, 'Fixture signature matches the installed official SDK.');
  for (const env of [{}, { ...ownerEnv, SPW_APP_TOKEN: '' }, { ...ownerEnv, MASQ_OWNER_ACCOUNT_IDS: '' },
    { ...ownerEnv, SPW_TIMESTAMP_UNIT: '' }, { ...ownerEnv, SPW_TIMESTAMP_UNIT: 'auto' }]) {
    const auth = createAdminAuth({ env, now });
    eq(auth.configured, false); throwsCode(() => auth.authenticate(sample), 'AUTH_UNCONFIGURED');
  }
  const auth = createAdminAuth({ env: ownerEnv, now });
  for (const patch of [{roles:[],isAdmin:false},{roles:['member'],isAdmin:true},
    {roles:['member','editor'],isAdmin:false},{username:'РусскийНик'}]) {
    const claim=signedClaim(patch);
    eq(checkUser(claim,tokenSecret),true);
    eq(auth.authenticate(claim).profile.accountId,claim.accountId,'Server signature agrees with the official SDK.');
  }
  const owner = auth.authenticate(sample), another = auth.authenticate(sample);
  eq(owner.capabilities, ['settings:read', 'settings:write', 'audit:read']);
  ok(owner.token !== another.token, 'Every session gets an independent random bearer.');
  eq(owner.expiresAt, now() + SESSION_TTL_MS);
  eq(Object.keys(owner.profile).sort(), ['accountId', 'minecraftUUID', 'username']);
  eq(auth.resolve(`Bearer ${owner.token}`).profile.accountId, 'owner-account-1');
  const providerAdmin = auth.authenticate(signedClaim({ accountId: 'unlisted-player', roles: ['owner', 'admin'], isAdmin: true }));
  eq(providerAdmin.capabilities, [], 'Provider admin metadata never grants casino capability.');
  throwsCode(() => auth.resolve(`Bearer ${providerAdmin.token}`, 'settings:read'), 'FORBIDDEN');
  for (const patch of [{ hash: '0'.repeat(64) }, { username: 'tampered' }]) {
    throwsCode(() => auth.authenticate({ ...sample, ...patch }), 'INVALID_SIGNATURE');
  }
  for (const malformed of [{ ...sample, extra: true }, { ...sample, roles: 'admin' }, { ...sample, roles: new Array(65).fill('role') },
    { ...sample, timestamp: String(sample.timestamp) }, { ...sample, isAdmin: 1 }, { ...sample, accountId: '\nowner-account-1' },
    Object.fromEntries(Object.entries(sample).filter(([key]) => key !== 'roles')), null, []]) {
    throwsCode(() => auth.authenticate(malformed), 'INVALID_CLAIM');
  }
  throwsCode(() => auth.authenticate(signedClaim({ timestamp: now() - CLAIM_MAX_AGE_MS - 1 })), 'EXPIRED_CLAIM');
  throwsCode(() => auth.authenticate(signedClaim({ timestamp: now() + CLAIM_FUTURE_SKEW_MS + 1 })), 'EXPIRED_CLAIM');
  ok(auth.authenticate(signedClaim({ timestamp: now() - CLAIM_MAX_AGE_MS })).token);
  ok(auth.authenticate(signedClaim({ timestamp: now() + CLAIM_FUTURE_SKEW_MS })).token);
  const secondsAuth = createAdminAuth({ env: { ...ownerEnv, SPW_TIMESTAMP_UNIT: 'seconds' }, now });
  ok(secondsAuth.authenticate(signedClaim({ timestamp: Math.floor(now() / 1000) })).token);
  throwsCode(() => secondsAuth.authenticate(sample), 'EXPIRED_CLAIM', 'Wrong timestamp unit must not be guessed.');
  auth.revoke(`Bearer ${owner.token}`);
  throwsCode(() => auth.resolve(`Bearer ${owner.token}`), 'UNAUTHENTICATED');
  throwsCode(() => auth.resolve(`Bearer ${owner.token}?demo-admin=1`), 'UNAUTHENTICATED');
  timestamp += SESSION_TTL_MS;
  throwsCode(() => auth.resolve(`Bearer ${another.token}`), 'UNAUTHENTICATED');
  const capped = createAdminAuth({ env: ownerEnv, now, maxSessions: 1 });
  const only = capped.authenticate(signedClaim());
  throwsCode(() => capped.authenticate(signedClaim()), 'SESSION_CAPACITY');
  capped.revoke(`Bearer ${only.token}`); ok(capped.authenticate(signedClaim()).token);

  const databasePath = join(testDirectory, 'durable.sqlite');
  let store = createAdminStore({ databasePath, now });
  const initial = store.read(); eq(initial.revision, 1); eq(initial.settings, ADMIN_DEFAULTS); eq(store.audit().entries, []);
  const next = clone(initial.settings); next.rtpProfiles.slots = 56;
  const actor = { accountId: 'owner-account-1', username: 'deathlain' };
  const saved = store.update({ expectedRevision: 1, settings: next, reason: 'Проверка общей настройки' }, actor);
  eq(saved.revision, 2); eq(saved.changed, true); eq(store.audit().entries.length, 1);
  eq(store.audit().entries[0].actor, actor); eq(store.audit().entries[0].before, initial.settings); eq(store.audit().entries[0].after, next);
  throwsCode(() => store.update({ expectedRevision: 1, settings: next, reason: 'Устаревшая версия' }, actor), 'REVISION_CONFLICT');
  eq(store.audit().entries.length, 1);
  eq(store.update({ expectedRevision: 2, settings: next, reason: 'Без изменений' }, actor).changed, false);
  eq(store.audit().entries.length, 1, 'No-op creates no false revision or audit entry.');
  for (const corrupt of [
    { ...next, perUserProfiles: { target: 95 } },
    { ...next, rtpProfiles: { ...next.rtpProfiles, slots: '56' } },
    { ...next, rtpProfiles: { ...next.rtpProfiles, slots: 96 } },
    { ...next, rtpProfiles: { ...next.rtpProfiles, slots: 50.5 } },
    { ...next, stakeLimits: { ...next.stakeLimits, slots: { min: 5, max: 105, step: 5 } } },
    { ...next, presentation: { ...next.presentation, sfxVolume: 10.5 } },
    { ...next, presentation: { ...next.presentation, speed: 3 } },
  ]) {
    throwsCode(() => store.update({ expectedRevision: 2, settings: corrupt, reason: 'Некорректная настройка' }, actor), 'INVALID_SETTINGS');
    eq(store.read(), { revision: 2, settings: next }); eq(store.audit().entries.length, 1);
  }
  throwsCode(() => store.update({ expectedRevision: 2, settings: next, reason: ' ' }, actor), 'INVALID_REASON');
  throwsCode(() => store.update({ expectedRevision: '2', settings: next, reason: 'Строковая версия' }, actor), 'INVALID_REVISION');
  throwsCode(() => store.update({ expectedRevision: 2, settings: next, reason: 'Лишний вход', balance: 999999 }, actor), 'INVALID_REQUEST');
  // A database failure while appending audit must roll back the preceding
  // settings update, not leave an unaudited changed profile behind.
  const faultDB = new DatabaseSync(databasePath);
  faultDB.exec("CREATE TRIGGER fail_audit BEFORE INSERT ON admin_audit BEGIN SELECT RAISE(ABORT,'synthetic audit failure'); END;");
  const failing = clone(next); failing.rtpProfiles.slots = 57;
  checks++; assert.throws(() => store.update({ expectedRevision: 2, settings: failing, reason: 'Ошибка аудита' }, actor));
  eq(store.read(), { revision: 2, settings: next }); eq(store.audit().entries.length, 1);
  faultDB.exec('DROP TRIGGER fail_audit;'); faultDB.close();
  store.close(); store = createAdminStore({ databasePath, now });
  eq(store.read(), { revision: 2, settings: next }); eq(store.audit().entries.length, 1, 'Settings and audit survive restart.');
  const secondConnection = createAdminStore({ databasePath, now });
  const staleSnapshot = secondConnection.read();
  store.update({ expectedRevision: 2, settings: failing, reason: 'Первый администратор' }, actor);
  throwsCode(() => secondConnection.update({ expectedRevision: staleSnapshot.revision, settings: next, reason: 'Второй администратор' }, actor), 'REVISION_CONFLICT');
  eq(secondConnection.read().revision, 3); secondConnection.close();
  const fourth = clone(failing); fourth.classicRtpProfiles.dice = 71;
  store.update({ expectedRevision: 3, settings: fourth, reason: 'Следующая версия' }, actor);
  const firstPage = store.audit({ limit: 2 }); eq(firstPage.entries.map(row => row.revision), [4, 3]); ok(firstPage.nextCursor);
  const lastPage = store.audit({ limit: 2, cursor: firstPage.nextCursor }); eq(lastPage.entries.map(row => row.revision), [2]); eq(lastPage.nextCursor, null);
  throwsCode(() => store.audit({ limit: 101 }), 'INVALID_PAGINATION'); store.close();

  const httpDB = join(testDirectory, 'http.sqlite');
  application = createAdminServer({ env: ownerEnv, databasePath: httpDB, appOrigin: origin, now });
  await new Promise(resolveListen => application.server.listen(0, '127.0.0.1', resolveListen));
  let baseURL = `http://127.0.0.1:${application.server.address().port}`;
  async function call(path, { method = 'GET', body, token, requestOrigin = origin, headers = {} } = {}) {
    const response = await fetch(baseURL + path, { method, headers: { ...(requestOrigin === null ? {} : { Origin: requestOrigin }),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }) });
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const publicConfig = await call('/api/config'); eq(publicConfig.status, 200); eq(publicConfig.body.currencyMode, 'unavailable');
  eq(publicConfig.body.gameplayMode, 'browser-demo'); eq(publicConfig.headers.get('cache-control'), 'no-store');
  eq(Object.keys(publicConfig.body).sort(), ['currencyMode', 'gameplayMode', 'revision', 'settings']);
  eq((await call('/api/admin/settings')).status, 401);
  eq((await call('/api/admin/settings?demo-admin=1')).status, 400, 'A query never grants server access.');
  eq((await call('/api/auth/spw', { method: 'POST', body: signedClaim(), requestOrigin: 'https://attacker.invalid' })).status, 403);
  eq((await call('/api/auth/spw', { method: 'POST', body: signedClaim(), requestOrigin: null })).status, 403);
  eq((await call('/api/auth/spw', { method: 'POST', body: signedClaim(), headers: { 'Content-Type': 'text/plain' } })).status, 415);
  eq((await call('/api/auth/spw', { method: 'POST', body: '{' })).status, 400);
  eq((await call('/api/auth/spw', { method: 'POST', body: JSON.stringify({ huge: 'x'.repeat(MAX_JSON_BYTES) }) })).status, 413);
  const login = await call('/api/auth/spw', { method: 'POST', body: signedClaim() }); eq(login.status, 200);
  const token = login.body.token;
  const otherLogin = await call('/api/auth/spw', { method: 'POST', body: signedClaim({ accountId: 'owner-account-2', username: 'second-owner' }) });
  eq(otherLogin.status, 200); const otherToken = otherLogin.body.token;
  const nonOwnerLogin = await call('/api/auth/spw', { method: 'POST', body: signedClaim({ accountId: 'unlisted-player', roles: ['admin'], isAdmin: true }) });
  eq(nonOwnerLogin.status, 200); eq(nonOwnerLogin.body.capabilities, []);
  eq((await call('/api/admin/settings', { token: nonOwnerLogin.body.token })).status, 403);
  eq((await call('/api/admin/audit', { token: nonOwnerLogin.body.token })).status, 403);
  eq((await call('/api/admin/settings', { token, requestOrigin: 'https://attacker.invalid' })).status, 403);
  eq((await call('/api/admin/settings', { token, requestOrigin: null })).status, 200);
  const settings = clone(publicConfig.body.settings); settings.rtpProfiles.lecipher = 60;
  const accepted = await call('/api/admin/settings', { method: 'PUT', token, body: { expectedRevision: 1, settings, reason: 'Локальная серверная проверка' } });
  eq(accepted.status, 200); eq(accepted.body.revision, 2);
  const conflict = await call('/api/admin/settings', { method: 'PUT', token: otherToken, body: { expectedRevision: 1, settings, reason: 'Вторая вкладка' } });
  eq(conflict.status, 409); eq(conflict.body.error.code, 'REVISION_CONFLICT');
  const audited = await call('/api/admin/audit?limit=100', { token }); eq(audited.status, 200); eq(audited.body.entries.length, 1);
  eq(audited.body.entries[0].actor, { accountId: 'owner-account-1', username: 'deathlain' });
  for (const query of ['limit=101', 'limit=0', 'limit=2.5', 'limit=10&limit=20', 'cursor=-1', 'balance=1000'])
    eq((await call(`/api/admin/audit?${query}`, { token })).status, 400);
  eq((await call('/api/admin/settings', { method: 'POST', token, body: {} })).status, 405);
  eq((await call('/api/wallet', { token })).status, 404, 'No pretend financial API is exposed.');
  eq((await call('/api/admin/mint', { method: 'POST', token, body: { balance: 1000 } })).status, 404);
  const revoked = await call('/api/auth/session', { method: 'DELETE', token }); eq(revoked.status, 200); eq(revoked.body, { ok: true });
  eq((await call('/api/admin/settings', { token })).status, 401);
  // Chunked bodies have the same bound as bodies declaring Content-Length.
  const chunked = await new Promise((resolveResult, reject) => {
    const req = httpRequest(baseURL + '/api/auth/spw', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json', 'Transfer-Encoding': 'chunked' } }, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk)); res.on('end', () => resolveResult({ status: res.statusCode, body: JSON.parse(Buffer.concat(chunks).toString()) }));
    });
    req.on('error', reject); req.write('{"long":"'); req.write('x'.repeat(MAX_JSON_BYTES)); req.end('"}');
  });
  eq(chunked.status, 413);
  await application.close(); application = createAdminServer({ env: ownerEnv, databasePath: httpDB, appOrigin: origin, now });
  await new Promise(resolveListen => application.server.listen(0, '127.0.0.1', resolveListen));
  baseURL = `http://127.0.0.1:${application.server.address().port}`;
  eq((await call('/api/config')).body.revision, 2); eq((await call('/api/config')).body.settings, settings);
  eq((await call('/api/admin/settings', { token: otherToken })).status, 401, 'Restart destroys bearer sessions but preserves settings.');
  const afterRestart = await call('/api/auth/spw', { method: 'POST', body: signedClaim() });
  eq((await call('/api/admin/audit', { token: afterRestart.body.token })).body.entries.length, 1);
  timestamp += SESSION_TTL_MS;
  eq((await call('/api/admin/settings', { token: afterRestart.body.token })).status, 401);
  timestamp += 60001;
  for (let i = 0; i < 30; i++) eq((await call('/api/auth/spw', { method: 'POST', body: signedClaim() })).status, 200);
  const limited = await call('/api/auth/spw', { method: 'POST', body: signedClaim() });
  eq(limited.status, 429); eq(limited.body.error.code, 'RATE_LIMITED');
  await application.close(); application = null;
  application = createAdminServer({ env: {}, databasePath: join(testDirectory, 'unconfigured.sqlite'), appOrigin: origin, now });
  await new Promise(resolveListen => application.server.listen(0, '127.0.0.1', resolveListen));
  baseURL = `http://127.0.0.1:${application.server.address().port}`;
  const closed = await call('/api/auth/spw', { method: 'POST', body: signedClaim() }); eq(closed.status, 503); eq(closed.body.error.code, 'AUTH_UNCONFIGURED');
  eq((await call('/api/config')).body.currencyMode, 'unavailable');
  eq((await call('/api/admin/settings?demo-admin=1')).status, 400);
  process.stdout.write(JSON.stringify({ passed: true, checks, externalRequests: 0, realCurrencyEnabled: false }, null, 2) + '\n');
} finally {
  if (application) await application.close();
  // Remove only the exact temporary test directory allocated above.
  const absolute = resolve(testDirectory), temporaryRoot = resolve(tmpdir());
  if (absolute.startsWith(temporaryRoot + '\\') || absolute.startsWith(temporaryRoot + '/')) rmSync(absolute, { recursive: true, force: true });
}
