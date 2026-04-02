const {
  applySecurityHeaders,
  buildCorsContext,
  enforceRateLimit,
  isJsonRequest,
  parseJsonBody,
  sendJson
} = require('../_security');
const { getPool, ensureSchema } = require('../_db');
const {
  normalizeEmail,
  validateEmail,
  validatePassword,
  validateDisplayName,
  hashPassword,
  buildSessionCookie,
  sanitizeUser,
  createSession,
  createId,
  USER_SELECT_COLUMNS
} = require('../_auth');

module.exports = async (req, res) => {
  const cors = buildCorsContext(req);
  applySecurityHeaders(req, res, cors.corsOrigin);
  res.setHeader('Allow', 'POST, OPTIONS');
  if (cors.corsOrigin) res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (!cors.allowed) {
    sendJson(res, 403, { error: { message: 'Origin not allowed.' } });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  if (!isJsonRequest(req)) {
    sendJson(res, 415, { error: { message: 'Content-Type must be application/json.' } });
    return;
  }

  const rateLimit = enforceRateLimit(req);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendJson(res, 429, { error: { message: 'Too many requests. Please slow down and try again shortly.' } });
    return;
  }

  try {
    await ensureSchema();
    const body = parseJsonBody(req) || {};
    const email = normalizeEmail(body.email);
    const password = String(body.password || '');
    const displayName = String(body.displayName || '').trim();

    if (!validateDisplayName(displayName)) {
      sendJson(res, 400, { error: { message: 'Display name must be between 2 and 60 characters.' } });
      return;
    }
    if (!validateEmail(email)) {
      sendJson(res, 400, { error: { message: 'Enter a valid email address.' } });
      return;
    }
    if (!validatePassword(password)) {
      sendJson(res, 400, { error: { message: 'Password must be at least 8 characters.' } });
      return;
    }

    const existing = await getPool().query('SELECT id FROM users WHERE email = $1 LIMIT 1', [email]);
    if (existing.rows.length) {
      sendJson(res, 409, { error: { message: 'An account with that email already exists.' } });
      return;
    }

    const userId = createId('user');
    const passwordHash = hashPassword(password);
    const created = await getPool().query(
      `INSERT INTO users (id, email, display_name, password_hash)
       VALUES ($1, $2, $3, $4)
       RETURNING ${USER_SELECT_COLUMNS}`,
      [userId, email, displayName, passwordHash]
    );

    await getPool().query(
      'INSERT INTO user_state (user_id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING',
      [userId, JSON.stringify({})]
    );

    const row = created.rows[0];
    const session = await createSession(req, row.id);
    res.setHeader('Set-Cookie', buildSessionCookie(req, session.sessionId, session.expiresAt));
    sendJson(res, 201, {
      ok: true,
      user: sanitizeUser(row)
    });
  } catch (error) {
    sendJson(res, 500, { error: { message: error.message || 'Signup failed.' } });
  }
};
