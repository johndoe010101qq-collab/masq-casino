import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const ADMIN_CAPABILITIES = Object.freeze(['settings:read', 'settings:write', 'audit:read']);
export const SESSION_TTL_MS = 15 * 60 * 1000;
export const CLAIM_MAX_AGE_MS = 5 * 60 * 1000;
export const CLAIM_FUTURE_SKEW_MS = 30 * 1000;
const USER_KEYS = ['accountId', 'username', 'minecraftUUID', 'timestamp', 'roles', 'isAdmin', 'hash'];
const UUID = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const safeText = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);

export class AdminAuthError extends Error {
  constructor(status, code, message) { super(message); this.name = 'AdminAuthError'; this.status = status; this.code = code; }
}

export function isSignedSPWClaim(user) {
  return Boolean(user && typeof user === 'object' && !Array.isArray(user)
    && Object.keys(user).length === USER_KEYS.length && USER_KEYS.every(key => Object.hasOwn(user, key))
    && safeText(user.accountId, 128) && safeText(user.username, 64)
    && typeof user.minecraftUUID === 'string' && UUID.test(user.minecraftUUID)
    && Number.isSafeInteger(user.timestamp) && user.timestamp > 0
    && Array.isArray(user.roles) && user.roles.length <= 64 && user.roles.every(role => safeText(role, 128))
    && typeof user.isAdmin === 'boolean' && typeof user.hash === 'string' && /^[a-f0-9]{64}$/.test(user.hash));
}

// Exact canonicalization from spwmini 1.2.0 checkUser, with a constant-time
// comparison. Conformance is checked against the official SDK in tests.
function validSignature(claim, token) {
  const checkString = Object.keys(claim).sort().filter(key => claim[key] && key !== 'hash')
    .map(key => `${key}=${claim[key]}`).join('\n');
  const expected = createHmac('sha256', createHash('sha256').update(token).digest())
    .update(checkString).digest();
  return timingSafeEqual(expected, Buffer.from(claim.hash, 'hex'));
}

function configuration(env) {
  const token = env.SPW_APP_TOKEN;
  const unit = env.SPW_TIMESTAMP_UNIT;
  const rawOwners = env.MASQ_OWNER_ACCOUNT_IDS;
  const owners = typeof rawOwners === 'string' ? rawOwners.split(',').map(value => value.trim()).filter(Boolean) : [];
  const valid = typeof token === 'string' && token.trim().length > 0 && token.length <= 1024
    && ['seconds', 'milliseconds'].includes(unit) && owners.length > 0 && owners.length <= 64
    && owners.every(value => safeText(value, 128));
  // The platform's timestamp unit is not documented by the installed SDK.
  // Require an explicitly confirmed unit rather than guessing from magnitude.
  return valid ? { token, unit, owners: new Set(owners) } : null;
}

export function createAdminAuth({ env = process.env, now = Date.now, maxSessions = 1000 } = {}) {
  if (!Number.isSafeInteger(maxSessions) || maxSessions < 1 || maxSessions > 10000) throw new TypeError('Invalid session capacity.');
  const config = configuration(env), sessions = new Map();
  const digest = token => createHash('sha256').update(token).digest('hex');
  const clock = () => {
    const value = now();
    if (!Number.isSafeInteger(value) || value < 0) throw new Error('Invalid server clock.');
    return value;
  };
  function prune(timestamp) {
    for (const [key, session] of sessions) if (session.expiresAt <= timestamp) sessions.delete(key);
  }
  function authenticate(claim) {
    if (!config) throw new AdminAuthError(503, 'AUTH_UNCONFIGURED', 'Серверный вход пока не настроен.');
    if (!isSignedSPWClaim(claim)) throw new AdminAuthError(400, 'INVALID_CLAIM', 'Некорректные данные профиля SP Worlds.');
    const timestamp = config.unit === 'seconds' ? claim.timestamp * 1000 : claim.timestamp;
    const current = clock();
    if (!Number.isSafeInteger(timestamp) || timestamp > current + CLAIM_FUTURE_SKEW_MS || timestamp < current - CLAIM_MAX_AGE_MS)
      throw new AdminAuthError(401, 'EXPIRED_CLAIM', 'Обновите профиль SP Worlds и повторите вход.');
    let valid = false;
    try { valid = validSignature(claim, config.token); } catch { /* Invalid signed input never establishes a session. */ }
    if (!valid) throw new AdminAuthError(401, 'INVALID_SIGNATURE', 'Не удалось подтвердить профиль SP Worlds.');
    prune(current);
    if (sessions.size >= maxSessions) throw new AdminAuthError(429, 'SESSION_CAPACITY', 'Временно недоступен новый сеанс. Повторите позже.');
    const profile = Object.freeze({ accountId: claim.accountId, username: claim.username, minecraftUUID: claim.minecraftUUID });
    // SPWorlds roles/isAdmin are signed provider metadata, not casino grants.
    const capabilities = config.owners.has(claim.accountId) ? ADMIN_CAPABILITIES : Object.freeze([]);
    const token = randomBytes(32).toString('base64url');
    const expiresAt = current + SESSION_TTL_MS;
    if (!Number.isSafeInteger(expiresAt)) throw new Error('Invalid session expiry.');
    const session = Object.freeze({ profile, capabilities, expiresAt });
    sessions.set(digest(token), session);
    return Object.freeze({ ...session, token });
  }
  function resolve(authorization, capability) {
    const current = clock(); prune(current);
    if (typeof authorization !== 'string' || !/^Bearer [a-zA-Z0-9_-]{43}$/.test(authorization))
      throw new AdminAuthError(401, 'UNAUTHENTICATED', 'Войдите через SP Worlds.');
    const session = sessions.get(digest(authorization.slice(7)));
    if (!session) throw new AdminAuthError(401, 'UNAUTHENTICATED', 'Сеанс истёк. Войдите через SP Worlds снова.');
    if (capability && !session.capabilities.includes(capability))
      throw new AdminAuthError(403, 'FORBIDDEN', 'Для этого действия нужны права администратора MASQ.');
    return session;
  }
  function revoke(authorization) {
    resolve(authorization);
    sessions.delete(digest(authorization.slice(7)));
    return true;
  }
  return Object.freeze({ authenticate, resolve, revoke, configured: Boolean(config), clear: () => sessions.clear() });
}
