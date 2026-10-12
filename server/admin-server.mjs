import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createAdminAuth, AdminAuthError } from './admin-auth.mjs';
import { createAdminStore, AdminStoreError } from './admin-store.mjs';
import { createRewardBank, RewardBankError } from './reward-bank.mjs';

export const MAX_JSON_BYTES = 16 * 1024;
const METHODS = Object.freeze({ '/api/auth/spw': ['POST'], '/api/auth/session': ['DELETE'],
  '/api/admin/settings': ['GET', 'PUT'], '/api/admin/rewards': ['GET', 'PUT'], '/api/admin/audit': ['GET'], '/api/config': ['GET'] });

class HttpError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

function configuredOrigin(value) {
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== value || url.username || url.password)
      throw new Error('Invalid origin');
    return url.origin;
  } catch { throw new TypeError('MASQ_APP_ORIGIN must be one exact HTTP(S) origin, without a path.'); }
}

function send(response, status, body, extra = {}) {
  if (response.headersSent || response.destroyed) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff', 'Cross-Origin-Resource-Policy': 'same-origin', ...extra });
  response.end(JSON.stringify(body));
}

async function readJSON(request) {
  if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] || ''))
    throw new HttpError(415, 'JSON_REQUIRED', 'Ожидается JSON.');
  const declared = request.headers['content-length'];
  if (declared !== undefined && (!/^\d+$/.test(declared) || Number(declared) > MAX_JSON_BYTES))
    throw new HttpError(413, 'BODY_TOO_LARGE', 'Слишком большой запрос.');
  const chunks = []; let bytes = 0;
  for await (const chunk of request.iterator({ destroyOnReturn: false })) {
    bytes += chunk.length;
    if (bytes > MAX_JSON_BYTES) throw new HttpError(413, 'BODY_TOO_LARGE', 'Слишком большой запрос.');
    chunks.push(chunk);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Object required');
    return parsed;
  } catch { throw new HttpError(400, 'INVALID_JSON', 'Некорректный JSON-объект.'); }
}

function createRateLimit({ now, maxKeys = 1024 }) {
  const buckets = new Map(), windowMs = 60 * 1000;
  return (key, maximum) => {
    const current = now();
    for (const [name, value] of buckets) if (value.until <= current) buckets.delete(name);
    let bucket = buckets.get(key);
    if (!bucket) {
      if (buckets.size >= maxKeys) throw new HttpError(429, 'RATE_LIMITED', 'Слишком много запросов. Повторите позже.');
      bucket = { until: current + windowMs, count: 0 }; buckets.set(key, bucket);
    }
    if (++bucket.count > maximum) throw new HttpError(429, 'RATE_LIMITED', 'Слишком много запросов. Повторите через минуту.');
  };
}

export function createAdminServer({ env = process.env, databasePath = env.MASQ_ADMIN_DB || resolve('server/data/masq-admin.sqlite'),
  rewardDatabasePath = databasePath === ':memory:' ? ':memory:' : databasePath + '.rewards.sqlite',
  appOrigin = env.MASQ_APP_ORIGIN || 'http://127.0.0.1:5178', now = Date.now } = {}) {
  const origin = configuredOrigin(appOrigin), auth = createAdminAuth({ env, now });
  const store = createAdminStore({ databasePath, now }), rateLimit = createRateLimit({ now });
  // No browser wager is an authoritative settled round. Until a trusted game
  // ledger is supplied, the owner can configure this bank but cannot fund/draw it.
  const rewardBank = createRewardBank({ databasePath: rewardDatabasePath, now });
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url, origin), allowed = METHODS[url.pathname];
      if (!allowed) throw new HttpError(404, 'NOT_FOUND', 'Адрес не найден.');
      if (!allowed.includes(request.method)) {
        send(response, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Метод недоступен.' } }, { Allow: allowed.join(', ') }); return;
      }
      const receivedOrigin = request.headers.origin;
      if (receivedOrigin !== undefined && receivedOrigin !== origin || ['POST', 'PUT', 'DELETE'].includes(request.method) && receivedOrigin !== origin)
        throw new HttpError(403, 'ORIGIN_REJECTED', 'Запрос должен быть отправлен из приложения MASQ.');
      // Do not trust proxy-supplied IP headers. This service binds loopback by
      // default and gets one explicitly configured frontend origin.
      const address = request.socket.remoteAddress || 'unknown';
      rateLimit(`all:${address}`, 300);
      if (url.pathname !== '/api/admin/audit' && url.search)
        throw new HttpError(400, 'INVALID_QUERY', 'Параметры адреса не поддерживаются.');
      if (['GET', 'DELETE'].includes(request.method) && (Number(request.headers['content-length'] || 0) > 0 || request.headers['transfer-encoding']))
        throw new HttpError(400, 'UNEXPECTED_BODY', 'Этот запрос не принимает тело.');
      if (url.pathname === '/api/auth/spw') {
        rateLimit(`auth:${address}`, 30);
        const result = auth.authenticate(await readJSON(request));
        send(response, 200, result); return;
      }
      if (url.pathname === '/api/auth/session') {
        auth.revoke(request.headers.authorization); send(response, 200, { ok: true }); return;
      }
      if (url.pathname === '/api/config') {
        send(response, 200, { ...store.read(), currencyMode: 'unavailable', gameplayMode: 'browser-demo' }); return;
      }
      if (url.pathname === '/api/admin/settings') {
        const capability = request.method === 'PUT' ? 'settings:write' : 'settings:read';
        const session = auth.resolve(request.headers.authorization, capability);
        if (request.method === 'GET') { send(response, 200, store.read()); return; }
        rateLimit(`write:${address}`, 60);
        send(response, 200, store.update(await readJSON(request), session.profile)); return;
      }
      if (url.pathname === '/api/admin/rewards') {
        const session = auth.resolve(request.headers.authorization, request.method === 'PUT' ? 'settings:write' : 'settings:read');
        if (request.method === 'GET') { send(response, 200, rewardBank.snapshot()); return; }
        rateLimit(`write:${address}`, 60);
        const body = await readJSON(request);
        if (Object.keys(body).length !== 3 || !['settings','expectedRevision','reason'].every(key => Object.hasOwn(body,key)))
          throw new HttpError(400, 'INVALID_REQUEST', 'Ожидаются настройки, версия и причина изменения.');
        const result = rewardBank.configure(body.settings, { actorId: session.profile.accountId,
          reason: body.reason, expectedRevision: body.expectedRevision });
        send(response, 200, { ...result.snapshot, changed: result.changed }); return;
      }
      auth.resolve(request.headers.authorization, 'audit:read');
      const parameters = url.searchParams;
      if ([...parameters.keys()].some(key => !['limit', 'cursor'].includes(key))
        || parameters.getAll('limit').length > 1 || parameters.getAll('cursor').length > 1)
        throw new HttpError(400, 'INVALID_PAGINATION', 'Недопустимые параметры страницы журнала.');
      const parseInteger = (key, fallback) => {
        if (!parameters.has(key)) return fallback;
        const raw = parameters.get(key);
        if (!/^[1-9]\d*$/.test(raw || '') || !Number.isSafeInteger(Number(raw)))
          throw new HttpError(400, 'INVALID_PAGINATION', 'Нужен положительный целый параметр страницы.');
        return Number(raw);
      };
      send(response, 200, store.audit({ limit: parseInteger('limit', 50), cursor: parseInteger('cursor', undefined) }));
    } catch (error) {
      if (error instanceof RewardBankError) {
        const conflict = error.code === 'REVISION_CONFLICT';
        const input = ['INVALID_POLICY','INVALID_REQUEST','INVALID_REASON','INVALID_REVISION','INVALID_ID'].includes(error.code);
        send(response, conflict ? 409 : input ? 400 : 500, { error: { code: conflict ? 'REVISION_CONFLICT' : input ? 'INVALID_REQUEST' : 'INTERNAL_ERROR',
          message: conflict ? 'Банк наград изменён. Обновите его настройки.' : input ? 'Проверьте настройки банка и причину изменения.' : 'Не удалось прочитать банк наград.' } });
        if (!request.readableEnded && !request.destroyed) request.resume();
        return;
      }
      const known = error instanceof HttpError || error instanceof AdminAuthError || error instanceof AdminStoreError;
      send(response, known ? error.status : 500, { error: { code: known ? error.code : 'INTERNAL_ERROR',
        message: known ? error.message : 'Не удалось выполнить запрос. Настройки не изменены.' } });
      // Drain rejected request bodies without recording credentials or claims.
      if (!request.readableEnded && !request.destroyed) request.resume();
    }
  });
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  server.maxRequestsPerSocket = 100;
  return Object.freeze({ server, authConfigured: auth.configured, close: () => new Promise((resolveClose, reject) => {
    const closeStore = () => { try { auth.clear(); store.close(); rewardBank.close(); resolveClose(); } catch (error) { reject(error); } };
    if (!server.listening) { closeStore(); return; }
    server.close(error => error ? reject(error) : closeStore());
    server.closeIdleConnections();
  }) });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = process.env.MASQ_ADMIN_PORT === undefined ? 5187 : Number(process.env.MASQ_ADMIN_PORT);
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) throw new TypeError('MASQ_ADMIN_PORT must be an integer between 1 and 65535.');
  const application = createAdminServer();
  application.server.listen(port, '127.0.0.1', () => {
    process.stdout.write(`MASQ admin API: http://127.0.0.1:${port}\n`);
    process.stdout.write(`SP Worlds authentication: ${application.authConfigured ? 'configured' : 'unavailable (required server configuration is missing)'}\n`);
    process.stdout.write('Financial gameplay: unavailable. Browser games remain demonstrational.\n');
  });
  const shutdown = () => { application.close().then(() => { process.exitCode = 0; }, () => { process.exitCode = 1; }); };
  process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
}
