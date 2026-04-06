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

function resolveGeminiApiKey() {
  return String(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function buildGeminiPayload(payload) {
  const systemParts = payload.messages
    .filter(message => message.role === 'system')
    .map(message => message.content.trim())
    .filter(Boolean);

  const contents = [];

  for (const message of payload.messages) {
    if (message.role === 'system') continue;
    const role = message.role === 'assistant' ? 'model' : 'user';
    const previous = contents[contents.length - 1];

    if (previous && previous.role === role) {
      previous.parts.push({ text: message.content });
      continue;
    }

    contents.push({
      role,
      parts: [{ text: message.content }]
    });
  }

  if (!contents.length) {
    contents.push({
      role: 'user',
      parts: [{ text: 'Respond to the latest system instructions.' }]
    });
  }

  const request = {
    contents,
    generationConfig: {
      temperature: payload.temperature
    }
  };

  if (systemParts.length) {
    request.systemInstruction = {
      parts: [{ text: systemParts.join('\n\n') }]
    };
  }

  if (payload.responseMimeType) {
    request.generationConfig.responseMimeType = payload.responseMimeType;
  }

  return request;
}

function extractGeminiText(payload) {
  const parts = payload?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return '';
  return parts
    .map(part => typeof part?.text === 'string' ? part.text : '')
    .join('')
    .trim();
}

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
      configured: Boolean(resolveGeminiApiKey())
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

  const apiKey = resolveGeminiApiKey();
  if (!apiKey) {
    sendJson(res, 500, { error: { message: 'GEMINI_API_KEY is not configured on the server.' } });
    return;
  }

  const body = parseJsonBody(req);
  const validation = validateProxyPayload(body);

  if (!validation.ok) {
    sendJson(res, 400, { error: { message: validation.message } });
    return;
  }

  const model = encodeURIComponent(validation.payload.model);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  try {
    const upstream = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildGeminiPayload(validation.payload))
    });

    const rawText = await upstream.text();
    const parsed = safeParseJson(rawText);

    if (!upstream.ok) {
      sendJson(res, upstream.status, parsed || { error: { message: 'Gemini upstream request failed.' } });
      return;
    }

    const text = extractGeminiText(parsed);
    if (!text) {
      sendJson(res, 502, { error: { message: 'The Gemini proxy returned an empty response.' } });
      return;
    }

    sendJson(res, 200, {
      text,
      model: validation.payload.model,
      provider: 'gemini'
    });
  } catch {
    sendJson(res, 502, { error: { message: 'The Gemini proxy could not reach the upstream service.' } });
  }
};
