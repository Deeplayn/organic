const {
  applySecurityHeaders,
  buildCorsContext,
  sendJson
} = require('../_security');
const { getOAuthProvidersStatus } = require('../_oauth');

module.exports = async (req, res) => {
  const cors = buildCorsContext(req);
  applySecurityHeaders(req, res, cors.corsOrigin);
  res.setHeader('Allow', 'GET, OPTIONS');

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

  sendJson(res, 200, {
    ok: true,
    providers: getOAuthProvidersStatus()
  });
};
