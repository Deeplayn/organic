const {
  applySecurityHeaders,
  buildCorsContext,
  parseJsonBody,
  sendJson
} = require('../_security');
const { clearSession, parseCookies, buildExpiredSessionCookie, COOKIE_NAME } = require('../_auth');

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

  try {
    parseJsonBody(req);
    const cookies = parseCookies(req);
    await clearSession(cookies[COOKIE_NAME]);
    res.setHeader('Set-Cookie', buildExpiredSessionCookie(req));
    sendJson(res, 200, { ok: true, user: null });
  } catch (error) {
    sendJson(res, 500, { error: { message: error.message || 'Logout failed.' } });
  }
};
