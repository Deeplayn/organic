require('./_env');

const {
  applySecurityHeaders,
  buildCorsContext,
  enforceRateLimit,
  isJsonRequest,
  parseJsonBody,
  sendJson,
  validateProxyPayload
} = require('./_security');

module.exports = async (req, res) => {
  const cors = buildCorsContext(req);
  applySecurityHeaders(req, res, cors.corsOrigin);
  res.setHeader('Allow', 'GET, POST, OPTIONS');

  if (!cors.allowed) {
    sendJson(res, 403, { error: { message: 'Origin not allowed.' } });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      configured: Boolean(process.env.XAI_API_KEY)
    });
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

  if (!process.env.XAI_API_KEY) {
    sendJson(res, 500, { error: { message: 'XAI_API_KEY is not configured on the server.' } });
    return;
  }

  const body = parseJsonBody(req);
  const validation = validateProxyPayload(body);

  if (!validation.ok) {
    sendJson(res, 400, { error: { message: validation.message } });
    return;
  }

  try {
    const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.XAI_API_KEY}`
      },
      body: JSON.stringify(validation.payload)
    });

    const text = await upstream.text();
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(upstream.status).send(text);
  } catch {
    sendJson(res, 502, { error: { message: 'The xAI proxy could not reach the upstream service.' } });
  }
};
