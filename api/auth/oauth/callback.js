const {
  applySecurityHeaders,
  buildCorsContext
} = require('../../_security');
const {
  parseQuery,
  sanitizeReturnTo,
  getRequestOrigin
} = require('../../_auth');
const { completeProviderLogin, buildOAuthErrorRedirect } = require('../../_oauth');

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

  if (params.get('error')) {
    const redirect = buildOAuthErrorRedirect(req, String(params.get('error_description') || params.get('error') || 'Authentication was cancelled.'), returnTo);
    res.setHeader('Set-Cookie', redirect.cookie);
    res.writeHead(302, { Location: redirect.location });
    res.end();
    return;
  }

  if (!params.get('code') || !params.get('state')) {
    const redirect = buildOAuthErrorRedirect(req, 'The OAuth callback did not include the required verification data.', returnTo);
    res.setHeader('Set-Cookie', redirect.cookie);
    res.writeHead(302, { Location: redirect.location });
    res.end();
    return;
  }

  try {
    const completed = await completeProviderLogin(req, provider, params);
    res.setHeader('Set-Cookie', completed.cookies);
    res.writeHead(302, { Location: new URL(completed.returnTo, `${getRequestOrigin(req)}/`).toString() });
    res.end();
  } catch (error) {
    const redirect = buildOAuthErrorRedirect(req, error.message || 'OAuth sign-in failed.', returnTo);
    res.setHeader('Set-Cookie', redirect.cookie);
    res.writeHead(302, { Location: redirect.location });
    res.end();
  }
};
