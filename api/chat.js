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

function resolveGroqApiKey() {
  return String(process.env.GROQ_API_KEY || '').trim();
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function extractOpenAIText(payload) {
  const content = payload?.choices?.[0]?.message?.content;
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
      return '';
    })
    .join('')
    .trim();
}

function normalizeGroqModel(model) {
  const raw = String(model || '').trim();
  if (!raw) return 'llama-3.3-70b-versatile';
  if (raw.startsWith('groq/')) return normalizeGroqModel(raw.slice(5));
  if (raw === 'llama3-70b-8192') return 'llama-3.3-70b-versatile';
  return raw;
}

function buildGroqPayload(payload) {
  const request = {
    model: normalizeGroqModel(payload.model),
    messages: payload.messages.map(message => ({
      role: message.role,
      content: message.content
    })),
    temperature: payload.temperature
  };

  if (payload.responseMimeType === 'application/json') {
    request.response_format = { type: 'json_object' };
  }

  return request;
}

async function sendGroqRequest(payload) {
  const apiKey = resolveGroqApiKey();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      body: { error: { message: 'GROQ_API_KEY is not configured on the server.' } }
    };
  }

  const normalizedModel = normalizeGroqModel(payload.model);

  try {
    const upstream = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(buildGroqPayload(payload))
    });

    const rawText = await upstream.text();
    const parsed = safeParseJson(rawText);

    if (!upstream.ok) {
      return {
        ok: false,
        status: upstream.status,
        body: parsed || { error: { message: 'Groq upstream request failed.' } }
      };
    }

    const text = extractOpenAIText(parsed);
    if (!text) {
      return {
        ok: false,
        status: 502,
        body: { error: { message: 'The Groq proxy returned an empty response.' } }
      };
    }

    return {
      ok: true,
      status: 200,
      body: {
        text,
        model: normalizedModel,
        provider: 'groq'
      }
    };
  } catch {
    return {
      ok: false,
      status: 502,
      body: { error: { message: 'The Groq proxy could not reach the upstream service.' } }
    };
  }
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
      configured: Boolean(resolveGroqApiKey()),
      defaults: {
        chat: 'llama-3.3-70b-versatile',
        planner: 'llama-3.3-70b-versatile',
        quiz: 'mixtral-8x7b-32768'
      }
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

  const body = parseJsonBody(req);
  const validation = validateProxyPayload(body);

  if (!validation.ok) {
    sendJson(res, 400, { error: { message: validation.message } });
    return;
  }

  if (!resolveGroqApiKey()) {
    sendJson(res, 500, { error: { message: 'GROQ_API_KEY is not configured on the server.' } });
    return;
  }

  const result = await sendGroqRequest(validation.payload);
  sendJson(res, result.status, result.body);
};
