const crypto = require('crypto');
const { getPool, ensureSchema } = require('./_db');

const COOKIE_NAME = 'oc_session';

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function validateEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

function validatePassword(value) {
  return typeof value === 'string' && value.length >= 8 && value.length <= 200;
}

function validateDisplayName(value) {
  const trimmed = String(value || '').trim();
  return trimmed.length >= 2 && trimmed.length <= 60;
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, storedHash) {
  const parts = String(storedHash || '').split(':');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const [, salt, expectedHex] = parts;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(18).toString('hex')}`;
}

function parseCookies(req) {
  const cookieHeader = String(req.headers.cookie || '');
  return cookieHeader.split(';').reduce((acc, part) => {
    const [name, ...rest] = part.trim().split('=');
    if (!name) return acc;
    acc[name] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function sessionDays() {
  const value = Number.parseInt(process.env.AUTH_SESSION_DAYS || '', 10);
  return Number.isFinite(value) && value > 0 ? value : 30;
}

function buildSessionCookie(req, sessionId, expiresAt) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.max(1, Math.round((expiresAt.getTime() - Date.now()) / 1000))}`
  ];

  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function buildExpiredSessionCookie(req) {
  const parts = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0'
  ];
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') {
    parts.push('Secure');
  }
  return parts.join('; ');
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    theme: row.theme || 'lab-noir'
  };
}

async function createSession(req, userId) {
  await ensureSchema();
  const pool = getPool();
  const sessionId = createId('sess');
  const expiresAt = new Date(Date.now() + sessionDays() * 24 * 60 * 60 * 1000);

  await pool.query(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES ($1, $2, $3)',
    [sessionId, userId, expiresAt]
  );

  return {
    sessionId,
    expiresAt
  };
}

async function clearSession(sessionId) {
  if (!sessionId) return;
  await ensureSchema();
  await getPool().query('DELETE FROM sessions WHERE id = $1', [sessionId]);
}

async function purgeExpiredSessions() {
  await ensureSchema();
  await getPool().query('DELETE FROM sessions WHERE expires_at <= NOW()');
}

async function getSessionUser(req) {
  await purgeExpiredSessions();
  const cookies = parseCookies(req);
  const sessionId = cookies[COOKIE_NAME];
  if (!sessionId) return null;

  const result = await getPool().query(
    `SELECT users.id, users.email, users.display_name, users.theme
     FROM sessions
     JOIN users ON users.id = sessions.user_id
     WHERE sessions.id = $1 AND sessions.expires_at > NOW()
     LIMIT 1`,
    [sessionId]
  );

  return {
    sessionId,
    user: sanitizeUser(result.rows[0] || null)
  };
}

module.exports = {
  COOKIE_NAME,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateDisplayName,
  hashPassword,
  verifyPassword,
  createId,
  parseCookies,
  buildSessionCookie,
  buildExpiredSessionCookie,
  sanitizeUser,
  createSession,
  clearSession,
  getSessionUser
};
