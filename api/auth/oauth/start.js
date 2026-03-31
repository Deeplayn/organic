const {
  applySecurityHeaders,
  buildCorsContext
} = require('../../_security');
const {
  parseQuery,
  sanitizeReturnTo,
  getRequestOrigin,
  buildAuthPageUrl
} = require('../../_auth');
const { buildProviderStartUrl } = require('../../_oauth');

module.exports = async (req, res) => {
  const cors = buildCorsContext(req);
  applySecurityHeaders(req, res, cors.corsOrigin);
  res.setHeader('Allow', 'GET, OPTIONS');

  if (!cors.allowed) {
    res.status(403).send('Origin not allowed.');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).send('Method not allowed.');
    return;
  }

  const params = parseQuery(req);
  const provider = String(params.get('provider') || '').trim().toLowerCase();
  const returnTo = sanitizeReturnTo(params.get('returnTo'), getRequestOrigin(req));

  try {
    const start = buildProviderStartUrl(req, provider, returnTo);
    res.setHeader('Set-Cookie', start.cookie);
    res.writeHead(302, { Location: start.location });
    res.end();
  } catch (error) {
    const location = buildAuthPageUrl(req, {
      mode: 'login',
      message: error.message || 'OAuth sign-in could not be started.',
      returnTo
    });
    res.writeHead(302, { Location: location });
    res.end();
  }
};
