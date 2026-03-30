const {
  applySecurityHeaders,
  buildCorsContext,
  sendJson
} = require('../_security');
const { ensureSchema } = require('../_db');
const { getSessionUser } = require('../_auth');

module.exports = async (req, res) => {
  const cors = buildCorsContext(req);
  applySecurityHeaders(req, res, cors.corsOrigin);
  res.setHeader('Allow', 'GET, OPTIONS');
  if (cors.corsOrigin) res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (!cors.allowed) {
    sendJson(res, 403, { error: { message: 'Origin not allowed.' } });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    sendJson(res, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  try {
    await ensureSchema();
    const session = await getSessionUser(req);
    sendJson(res, 200, {
      ok: true,
      user: session?.user || null
    });
  } catch (error) {
    sendJson(res, 500, { error: { message: error.message || 'Session lookup failed.' } });
  }
};
