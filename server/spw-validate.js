import express from 'express';
import { checkUser } from 'spwmini/middleware';

const app = express();
const token = process.env.SPW_APP_TOKEN;
if (!token) throw new Error('Missing server-only SPW_APP_TOKEN');
const uuid = /^(?:[a-f0-9]{32}|[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/i;
const keys = new Set([
  'accountId', 'username', 'minecraftUUID', 'timestamp', 'roles', 'isAdmin', 'hash',
]);
const textWithin = (value, max) =>
  typeof value === 'string' && value.length > 0 && value.length <= max;
function isUserData(user) {
  return Boolean(
    user && typeof user === 'object' && !Array.isArray(user) &&
    Object.keys(user).every((key) => keys.has(key)) &&
    textWithin(user.accountId, 128) && textWithin(user.username, 64) &&
    typeof user.minecraftUUID === 'string' && uuid.test(user.minecraftUUID) &&
    Number.isSafeInteger(user.timestamp) && user.timestamp > 0 &&
    Array.isArray(user.roles) && user.roles.length <= 64 &&
    user.roles.every((role) => textWithin(role, 128)) &&
    typeof user.isAdmin === 'boolean' &&
    typeof user.hash === 'string' && /^[a-f0-9]{64}$/.test(user.hash)
  );
}
app.use((req, res, next) => {
  // Required on the frontend HTML response too, including reverse-proxy/CDN.
  res.set('Content-Security-Policy', 'frame-ancestors https://spworlds.ru');
  next();
});
app.post(
  '/api/spw/validate',
  express.json({ limit: '8kb' }),
  (req, res) => {
    res.set('Cache-Control', 'no-store').type('text/plain');
    if (!isUserData(req.body)) return res.status(400).send('0');
    try {
      // Exact SDK signature: checkUser(userData, applicationToken).
      // The body is directly sdk.user, not { user: sdk.user }.
      return res.send(checkUser(req.body, token) ? '1' : '0');
    } catch {
      return res.status(400).send('0');
    }
  },
);
app.all('/api/spw/validate', (req, res) => {
  res.set('Allow', 'POST').type('text/plain').status(405).send('0');
});
app.use((error, req, res, next) => {
  if (req.path !== '/api/spw/validate') return next(error);
  const status = error?.status === 413 ? 413 : 400;
  res.set('Cache-Control', 'no-store').type('text/plain').status(status).send('0');
});

// Mount the frontend dist after these routes; preserve the CSP header.
// This endpoint only verifies a signed profile. It does not establish a game
// ledger, payment status, session, or permission to use server admin actions.
export default app;


