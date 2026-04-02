require('./_env');

const crypto = require('crypto');
const { getPool, ensureSchema } = require('./_db');

const COOKIE_NAME = 'oc_session';
const OAUTH_STATE_COOKIE = 'oc_oauth_state';
const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;
const DAILY_SERIAL_MAX = 999999;
const USER_SELECT_COLUMNS = [
  'id',
  'account_serial',
  'daily_serial_date',
  'daily_serial',
  'email',
  'display_name',
  'theme',
  'age',
  'gender',
  'country',
  'learner_type',
  'curriculum_track'
].join(', ');

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

function getRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();
  if (!host) return '';
  const proto = forwardedProto || inferRequestProtocol(req, host);
  return `${proto}://${host}`;
}

function normalizeOrigin(value) {
  const input = String(value || '').trim();
  if (!input) return '';

  try {
    return new URL(input).origin;
  } catch {
    return '';
  }
}

function getConfiguredAppOrigin() {
  return (
    normalizeOrigin(process.env.APP_BASE_URL) ||
    normalizeOrigin(process.env.PUBLIC_APP_URL)
  );
}

function getAppOrigin(req) {
  return getConfiguredAppOrigin() || getRequestOrigin(req);
}

function inferRequestProtocol(req, host = '') {
  if (req.socket?.encrypted || req.connection?.encrypted) {
    return 'https';
  }

  return /^localhost(?::\d+)?$|^127(?:\.\d{1,3}){3}(?::\d+)?$/i.test(String(host || '').trim())
    ? 'http'
    : 'https';
}

function parseQuery(req) {
  const origin = getRequestOrigin(req) || 'https://localhost';
  return new URL(req.url || '/', origin).searchParams;
}

function sanitizeReturnTo(value, requestOrigin = '') {
  const fallback = 'index.html#dashboard';
  const origin = requestOrigin || 'https://localhost';
  const raw = String(value || '').trim();
  if (!raw) return fallback;

  try {
    const url = new URL(raw, origin);
    if (requestOrigin && url.origin !== requestOrigin) {
      return fallback;
    }
    const file = url.pathname.split('/').pop() || 'index.html';
    const hash = String(url.hash || '').replace(/^#/, '').trim();
    if (/auth\.html$/i.test(file) || hash === 'auth') {
      return fallback;
    }
    return `${file}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

function buildAuthPageUrl(req, { mode = 'login', message = '', returnTo = '' } = {}) {
  const origin = getAppOrigin(req) || 'https://localhost';
  const url = new URL('/auth.html', origin);
  url.searchParams.set('mode', mode === 'signup' ? 'signup' : 'login');
  if (message) url.searchParams.set('message', message);
  if (returnTo) url.searchParams.set('returnTo', sanitizeReturnTo(returnTo, origin));
  return url.toString();
}

function buildCookie(req, name, value, options = {}) {
  const parts = [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${options.path || '/'}`,
    `SameSite=${options.sameSite || 'Lax'}`
  ];
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (options.expires) parts.push(`Expires=${options.expires.toUTCString()}`);
  if (typeof options.maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.round(options.maxAge))}`);

  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  if (proto === 'https') {
    parts.push('Secure');
  }

  return parts.join('; ');
}

function buildSessionCookie(req, sessionId, expiresAt) {
  return buildCookie(req, COOKIE_NAME, sessionId, {
    expires: expiresAt,
    maxAge: (expiresAt.getTime() - Date.now()) / 1000
  });
}

function buildExpiredCookie(req, name) {
  return buildCookie(req, name, '', {
    expires: new Date(0),
    maxAge: 0
  });
}

function buildExpiredSessionCookie(req) {
  return buildExpiredCookie(req, COOKIE_NAME);
}

function parseOptionalInteger(value) {
  const parsed = Number.parseInt(String(value ?? '').trim(), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeDateOnly(value) {
  if (!value) return '';
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : text.slice(0, 10);
}

function sanitizeUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    accountSerial: row.account_serial == null ? '' : String(row.account_serial),
    dailySerialDate: normalizeDateOnly(row.daily_serial_date),
    dailySerial: String(row.daily_serial || '').trim(),
    email: row.email,
    displayName: row.display_name,
    theme: row.theme || 'lab-noir',
    profile: {
      age: parseOptionalInteger(row.age),
      gender: String(row.gender || '').trim(),
      country: String(row.country || '').trim(),
      learnerType: String(row.learner_type || '').trim(),
      curriculumTrack: String(row.curriculum_track || '').trim()
    }
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

async function reserveDailyUserSerial(client, dateValue = new Date()) {
  const serialDate = normalizeDateOnly(dateValue) || new Date().toISOString().slice(0, 10);
  const result = await client.query(
    `INSERT INTO user_daily_serial_counters (serial_date, last_value, updated_at)
     VALUES ($1::date, 1, NOW())
     ON CONFLICT (serial_date)
     DO UPDATE SET last_value = user_daily_serial_counters.last_value + 1, updated_at = NOW()
     RETURNING last_value`,
    [serialDate]
  );

  const nextValue = Number(result.rows[0]?.last_value);
  if (!Number.isInteger(nextValue) || nextValue < 1 || nextValue > DAILY_SERIAL_MAX) {
    throw new Error('Daily account serial limit reached for this date.');
  }

  return {
    dailySerialDate: serialDate,
    dailySerial: String(nextValue).padStart(6, '0')
  };
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
    `SELECT users.id,
            users.account_serial,
            users.daily_serial_date,
            users.daily_serial,
            users.email,
            users.display_name,
            users.theme,
            users.age,
            users.gender,
            users.country,
            users.learner_type,
            users.curriculum_track
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

function base64urlEncode(value) {
  return Buffer.from(value).toString('base64url');
}

function base64urlDecode(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function resolveOAuthSecret() {
  const material = [
    process.env.AUTH_STATE_SECRET,
    process.env.DATABASE_URL,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.MICROSOFT_CLIENT_SECRET,
    process.env.GITHUB_CLIENT_SECRET
  ]
    .map(value => String(value || '').trim())
    .filter(Boolean)
    .join('|');

  if (!material) {
    throw new Error('OAuth secret material is not configured.');
  }

  return material;
}

function signOAuthPayload(payload) {
  return crypto.createHmac('sha256', resolveOAuthSecret()).update(payload).digest('base64url');
}

function createOAuthStateCookie(req, { provider, returnTo }) {
  const nonce = crypto.randomBytes(24).toString('hex');
  const payload = JSON.stringify({
    nonce,
    provider,
    returnTo: sanitizeReturnTo(returnTo, getRequestOrigin(req)),
    issuedAt: Date.now()
  });
  const encodedPayload = base64urlEncode(payload);
  const signature = signOAuthPayload(encodedPayload);
  return {
    state: nonce,
    cookie: buildCookie(req, OAUTH_STATE_COOKIE, `${encodedPayload}.${signature}`, {
      maxAge: OAUTH_STATE_TTL_MS / 1000,
      expires: new Date(Date.now() + OAUTH_STATE_TTL_MS)
    })
  };
}

function readOAuthState(req, expectedProvider, expectedState) {
  const cookies = parseCookies(req);
  const raw = String(cookies[OAUTH_STATE_COOKIE] || '');
  const [encodedPayload, signature] = raw.split('.');
  if (!encodedPayload || !signature) {
    throw new Error('OAuth state is missing.');
  }

  const expectedSignature = signOAuthPayload(encodedPayload);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);
  if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('OAuth state signature is invalid.');
  }

  const parsed = JSON.parse(base64urlDecode(encodedPayload));
  if (parsed.provider !== expectedProvider) {
    throw new Error('OAuth provider mismatch.');
  }
  if (parsed.nonce !== expectedState) {
    throw new Error('OAuth state did not match.');
  }
  if (!parsed.issuedAt || Date.now() - Number(parsed.issuedAt) > OAUTH_STATE_TTL_MS) {
    throw new Error('OAuth state has expired.');
  }

  return parsed;
}

function buildExpiredOAuthStateCookie(req) {
  return buildExpiredCookie(req, OAUTH_STATE_COOKIE);
}

module.exports = {
  COOKIE_NAME,
  OAUTH_STATE_COOKIE,
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateDisplayName,
  hashPassword,
  verifyPassword,
  createId,
  parseCookies,
  parseQuery,
  getRequestOrigin,
  getConfiguredAppOrigin,
  getAppOrigin,
  sanitizeReturnTo,
  buildAuthPageUrl,
  buildSessionCookie,
  buildExpiredSessionCookie,
  buildExpiredCookie,
  USER_SELECT_COLUMNS,
  sanitizeUser,
  reserveDailyUserSerial,
  createSession,
  clearSession,
  getSessionUser,
  createOAuthStateCookie,
  readOAuthState,
  buildExpiredOAuthStateCookie
};
