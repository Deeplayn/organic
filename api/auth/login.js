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
  verifyPassword,
  buildSessionCookie,
  sanitizeUser,
  createSession
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

    if (!validateEmail(email) || !validatePassword(password)) {
      sendJson(res, 400, { error: { message: 'Enter a valid email and password.' } });
      return;
    }

    const result = await getPool().query(
      'SELECT id, email, display_name, theme, password_hash FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    const row = result.rows[0];

    if (!row || !verifyPassword(password, row.password_hash)) {
      sendJson(res, 401, { error: { message: 'Email or password is incorrect.' } });
      return;
    }

    const session = await createSession(req, row.id);
    res.setHeader('Set-Cookie', buildSessionCookie(req, session.sessionId, session.expiresAt));
    sendJson(res, 200, {
      ok: true,
      user: sanitizeUser(row)
    });
  } catch (error) {
    sendJson(res, 500, { error: { message: error.message || 'Login failed.' } });
  }
};
