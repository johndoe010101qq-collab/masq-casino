import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { validateDemoSettings } from '../src/demo-settings.js';
import { ADMIN_DEFAULTS } from '../src/demo-admin-controls.js';

export class AdminStoreError extends Error {
  constructor(status, code, message) { super(message); this.name = 'AdminStoreError'; this.status = status; this.code = code; }
}

export function validateServerSettings(value) {
  try {
    const settings = validateDemoSettings(value);
    if (!Number.isInteger(settings.presentation.sfxVolume) || !Number.isInteger(settings.presentation.musicVolume))
      throw new RangeError('Громкость должна быть целым числом от 0 до 100.');
    return settings;
  } catch (error) {
    throw new AdminStoreError(400, 'INVALID_SETTINGS', error?.message || 'Некорректные настройки.');
  }
}

function validActor(actor) {
  return actor && typeof actor.accountId === 'string' && actor.accountId.length > 0 && actor.accountId.length <= 128
    && typeof actor.username === 'string' && actor.username.length > 0 && actor.username.length <= 64;
}

export function createAdminStore({ databasePath, now = Date.now } = {}) {
  if (typeof databasePath !== 'string' || !databasePath || databasePath.length > 4096) throw new TypeError('An explicit private database path is required.');
  const target = databasePath === ':memory:' ? databasePath : resolve(databasePath);
  if (target !== ':memory:') mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(target);
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL CHECK(revision>0), settings_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS admin_audit (
      id INTEGER PRIMARY KEY AUTOINCREMENT, revision INTEGER UNIQUE NOT NULL CHECK(revision>1),
      actor_account_id TEXT NOT NULL, actor_username TEXT NOT NULL, reason TEXT NOT NULL,
      created_at INTEGER NOT NULL, before_json TEXT NOT NULL, after_json TEXT NOT NULL
    );`);
  db.prepare('INSERT OR IGNORE INTO admin_settings(id,revision,settings_json) VALUES(1,1,?)')
    .run(JSON.stringify(validateServerSettings(ADMIN_DEFAULTS)));
  const currentQuery = db.prepare('SELECT revision,settings_json FROM admin_settings WHERE id=1');
  function read() {
    const row = currentQuery.get();
    if (!row || !Number.isSafeInteger(row.revision) || row.revision < 1) throw new Error('Invalid stored settings revision.');
    return Object.freeze({ revision: row.revision, settings: validateServerSettings(JSON.parse(row.settings_json)) });
  }
  // Validate the whole immutable settings document, then change settings and
  // append its actor/reason audit entry in one durable SQLite transaction.
  function update(input, actor) {
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length !== 3
      || !['expectedRevision', 'settings', 'reason'].every(key => Object.hasOwn(input, key)))
      throw new AdminStoreError(400, 'INVALID_REQUEST', 'Нужны версия настроек, полный набор настроек и причина изменения.');
    const { expectedRevision } = input;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
      throw new AdminStoreError(400, 'INVALID_REVISION', 'Нужна текущая целая версия настроек.');
    if (typeof input.reason !== 'string' || input.reason.trim().length < 1 || input.reason.length > 500 || /[\u0000-\u001f\u007f]/.test(input.reason))
      throw new AdminStoreError(400, 'INVALID_REASON', 'Укажите причину изменения: от 1 до 500 символов.');
    if (!validActor(actor)) throw new TypeError('A verified actor is required.');
    const next = validateServerSettings(input.settings), nextJSON = JSON.stringify(next), reason = input.reason.trim();
    db.exec('BEGIN IMMEDIATE');
    try {
      const previous = read();
      if (previous.revision !== expectedRevision)
        throw new AdminStoreError(409, 'REVISION_CONFLICT', 'Настройки уже изменены. Загрузите актуальную версию.');
      if (JSON.stringify(previous.settings) === nextJSON) {
        db.exec('COMMIT'); return Object.freeze({ ...previous, changed: false });
      }
      const revision = previous.revision + 1, createdAt = now();
      if (!Number.isSafeInteger(revision) || !Number.isSafeInteger(createdAt) || createdAt < 0) throw new Error('Invalid server revision or clock.');
      const saved = db.prepare('UPDATE admin_settings SET revision=?,settings_json=? WHERE id=1 AND revision=?')
        .run(revision, nextJSON, expectedRevision);
      if (saved.changes !== 1) throw new AdminStoreError(409, 'REVISION_CONFLICT', 'Настройки уже изменены. Загрузите актуальную версию.');
      db.prepare('INSERT INTO admin_audit(revision,actor_account_id,actor_username,reason,created_at,before_json,after_json) VALUES(?,?,?,?,?,?,?)')
        .run(revision, actor.accountId, actor.username, reason, createdAt, JSON.stringify(previous.settings), nextJSON);
      db.exec('COMMIT');
      return Object.freeze({ revision, settings: next, changed: true });
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  function audit({ limit = 50, cursor } = {}) {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100 || cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor < 1))
      throw new AdminStoreError(400, 'INVALID_PAGINATION', 'Размер страницы: от 1 до 100; курсор — положительное целое число.');
    const rows = cursor === undefined
      ? db.prepare('SELECT * FROM admin_audit ORDER BY id DESC LIMIT ?').all(limit + 1)
      : db.prepare('SELECT * FROM admin_audit WHERE id<? ORDER BY id DESC LIMIT ?').all(cursor, limit + 1);
    const more = rows.length > limit;
    const entries = rows.slice(0, limit).map(row => Object.freeze({ id: row.id, revision: row.revision,
      actor: Object.freeze({ accountId: row.actor_account_id, username: row.actor_username }),
      reason: row.reason, createdAt: row.created_at,
      before: validateServerSettings(JSON.parse(row.before_json)), after: validateServerSettings(JSON.parse(row.after_json)) }));
    return Object.freeze({ entries: Object.freeze(entries), nextCursor: more ? entries.at(-1).id : null });
  }
  return Object.freeze({ read, update, audit, close: () => db.close() });
}
