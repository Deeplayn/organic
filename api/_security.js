require('./_env');

const rateLimitBuckets = new Map();

function applySecurityHeaders(req, res, corsOrigin) {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), microphone=(), payment=(), usb=()');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Vary', 'Origin');

  if (corsOrigin) {
    res.setHeader('Access-Control-Allow-Origin', corsOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (isSecureRequest(req)) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
}

function buildCorsContext(req) {
  const requestOrigin = normalizeOrigin(buildRequestOrigin(req));
  const incomingOrigin = normalizeOrigin(req.headers.origin);
  const allowList = resolveAllowedOrigins(req, requestOrigin);
  const fetchSite = String(req.headers['sec-fetch-site'] || '').trim().toLowerCase();
  const trustedNoOrigin = !incomingOrigin && ['same-origin', 'same-site', 'none'].includes(fetchSite);

  if (!incomingOrigin) {
    return {
      allowed: req.method === 'GET' || trustedNoOrigin,
      corsOrigin: null
    };
  }

  if (allowList.has(incomingOrigin)) {
    return {
      allowed: true,
      corsOrigin: incomingOrigin
    };
  }

  return {
    allowed: false,
    corsOrigin: null
  };
}

function enforceRateLimit(req) {
  if (req.method !== 'POST') {
    return { allowed: true };
  }

  const now = Date.now();
  const windowMs = readPositiveInt('API_RATE_LIMIT_WINDOW_MS', 60_000);
  const maxRequests = readPositiveInt('API_RATE_LIMIT_MAX', 30);
  const bucketKey = `${resolveClientIp(req)}:${normalizeOrigin(req.headers.origin) || 'no-origin'}`;

  sweepExpiredBuckets(now);

  const bucket = rateLimitBuckets.get(bucketKey);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
    return {
      allowed: true,
      remaining: maxRequests - 1
    };
  }

  if (bucket.count >= maxRequests) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
    };
  }

  bucket.count += 1;
  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - bucket.count)
  };
}

function validateProxyPayload(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { ok: false, message: 'Invalid JSON body.' };
  }

  const model = String(body.model || '').trim();
  if (!model || model.length > 120) {
    return { ok: false, message: 'A valid model name is required.' };
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  const maxMessages = readPositiveInt('AI_PROXY_MAX_MESSAGES', 20);
  const maxChars = readPositiveInt('AI_PROXY_MAX_CHARS', 24_000);

  if (!messages.length) {
    return { ok: false, message: 'At least one message is required.' };
  }

  if (messages.length > maxMessages) {
    return { ok: false, message: `Too many messages. Maximum allowed is ${maxMessages}.` };
  }

  const normalizedMessages = [];
  let totalChars = 0;

  for (const message of messages) {
    const role = String(message?.role || '').trim();
    const content = normalizeMessageContent(message?.content);

    if (!['system', 'user', 'assistant'].includes(role)) {
      return { ok: false, message: 'Unsupported message role received.' };
    }

    if (!content) {
      return { ok: false, message: 'Every message must include text content.' };
    }

    totalChars += content.length;
    if (totalChars > maxChars) {
      return { ok: false, message: `Message content is too large. Maximum allowed is ${maxChars} characters.` };
    }

    normalizedMessages.push({ role, content });
  }

  const temperature = typeof body.temperature === 'number' ? body.temperature : 0.4;
  if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
    return { ok: false, message: 'Temperature must be a number between 0 and 2.' };
  }

  const payload = {
    model,
    messages: normalizedMessages,
    temperature
  };

  if (body.responseMimeType !== undefined) {
    const responseMimeType = String(body.responseMimeType || '').trim();
    if (!['text/plain', 'application/json'].includes(responseMimeType)) {
      return { ok: false, message: 'Unsupported response MIME type.' };
    }
    payload.responseMimeType = responseMimeType;
  }

  return {
    ok: true,
    payload
  };
}

function parseJsonBody(req) {
  if (typeof req.body === 'string') {
    return safeParseJson(req.body);
  }

  if (Buffer.isBuffer(req.body)) {
    return safeParseJson(req.body.toString('utf8'));
  }

  return req.body;
}

function sendJson(res, statusCode, payload) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).send(JSON.stringify(payload));
}

function isJsonRequest(req) {
  if (req.method !== 'POST') {
    return true;
  }

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  return contentType.startsWith('application/json');
}

function normalizeMessageContent(content) {
  if (typeof content === 'string') {
    return content.trim();
  }

  if (!Array.isArray(content)) {
    return '';
  }

  return content
    .map(part => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      if (typeof part?.content === 'string') return part.content;
      return '';
    })
    .join('')
    .trim();
}

function resolveAllowedOrigins(req, requestOrigin) {
  const allowList = new Set();
  const envValue = String(process.env.ALLOWED_ORIGINS || '').trim();

  if (requestOrigin) {
    allowList.add(requestOrigin);
  }

  if (!envValue) {
    return allowList;
  }

  for (const origin of envValue.split(',')) {
    const normalized = normalizeOrigin(origin);
    if (normalized) {
      allowList.add(normalized);
    }
  }

  return allowList;
}

function buildRequestOrigin(req) {
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || String(req.headers.host || '').trim();

  if (!host) {
    return '';
  }

  const proto = forwardedProto || inferRequestProtocol(req, host);
  return `${proto}://${host}`;
}

function inferRequestProtocol(req, host = '') {
  if (req.socket?.encrypted || req.connection?.encrypted) {
    return 'https';
  }

  return /^localhost(?::\d+)?$|^127(?:\.\d{1,3}){3}(?::\d+)?$/i.test(String(host || '').trim())
    ? 'http'
    : 'https';
}

function normalizeOrigin(value) {
  const input = String(value || '').trim();
  if (!input) {
    return '';
  }

  try {
    return new URL(input).origin;
  } catch {
    return '';
  }
}

function resolveClientIp(req) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  return forwarded || realIp || 'unknown';
}

function isSecureRequest(req) {
  const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  return proto === 'https';
}

function readPositiveInt(name, fallback) {
  const value = Number.parseInt(process.env[name] || '', 10);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function sweepExpiredBuckets(now) {
  for (const [key, bucket] of rateLimitBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateLimitBuckets.delete(key);
    }
  }
}

module.exports = {
  applySecurityHeaders,
  buildCorsContext,
  enforceRateLimit,
  isJsonRequest,
  parseJsonBody,
  sendJson,
  validateProxyPayload
};
