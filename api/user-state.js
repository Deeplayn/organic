const {
  applySecurityHeaders,
  buildCorsContext,
  enforceRateLimit,
  isJsonRequest,
  parseJsonBody,
  sendJson
} = require('./_security');
const { getPool, ensureSchema } = require('./_db');
const { getSessionUser, validateDisplayName } = require('./_auth');

module.exports = async (req, res) => {
  const cors = buildCorsContext(req);
  applySecurityHeaders(req, res, cors.corsOrigin);
  res.setHeader('Allow', 'GET, PUT, OPTIONS');
  if (cors.corsOrigin) res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (!cors.allowed) {
    sendJson(res, 403, { error: { message: 'Origin not allowed.' } });
    return;
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!['GET', 'PUT'].includes(req.method)) {
    sendJson(res, 405, { error: { message: 'Method not allowed.' } });
    return;
  }

  if (req.method === 'PUT' && !isJsonRequest(req)) {
    sendJson(res, 415, { error: { message: 'Content-Type must be application/json.' } });
    return;
  }

  if (req.method === 'PUT') {
    const rateLimit = enforceRateLimit(req);
    if (!rateLimit.allowed) {
      res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
      sendJson(res, 429, { error: { message: 'Too many requests. Please slow down and try again shortly.' } });
      return;
    }
  }

  try {
    await ensureSchema();
    const session = await getSessionUser(req);
    if (!session?.user) {
      sendJson(res, 401, { error: { message: 'You must be signed in to access account state.' } });
      return;
    }

    if (req.method === 'GET') {
      const result = await getPool().query(
        'SELECT payload FROM user_state WHERE user_id = $1 LIMIT 1',
        [session.user.id]
      );
      const payload = result.rows[0]?.payload || null;
      const normalizedPayload = normalizePayload(
        {
          ...(payload || {}),
          profile: payload?.profile ?? session.user.profile,
          theme: payload?.theme ?? session.user.theme,
          displayName: payload?.displayName || session.user.displayName,
          avatarUrl: payload?.avatarUrl ?? session.user.avatarUrl
        },
        session.user.theme
      );
      sendJson(res, 200, {
        ok: true,
        user: session.user,
        hasData: Boolean((payload && Object.keys(payload).length) || hasProfileData(session.user.profile)),
        payload: normalizedPayload
      });
      return;
    }

    const body = parseJsonBody(req) || {};
    const existingResult = await getPool().query(
      'SELECT payload FROM user_state WHERE user_id = $1 LIMIT 1',
      [session.user.id]
    );
    const existingPayload = existingResult.rows[0]?.payload || {};
    const payload = normalizeIncomingPayload(body, {
      ...existingPayload,
      displayName: existingPayload.displayName || session.user.displayName,
      avatarUrl: existingPayload.avatarUrl ?? session.user.avatarUrl
    }, session.user.theme);
    const payloadJson = JSON.stringify(payload);

    if (payloadJson.length > 1_000_000) {
      sendJson(res, 400, { error: { message: 'User state payload is too large.' } });
      return;
    }

    await getPool().query(
      `INSERT INTO user_state (user_id, payload, updated_at)
       VALUES ($1, $2::jsonb, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW()`,
      [session.user.id, payloadJson]
    );

    await getPool().query(
      `UPDATE users
       SET theme = $2,
           display_name = $3,
           avatar_url = $4,
           age = $5,
           gender = $6,
           country = $7,
           learner_type = $8,
           academic_year = $9,
           curriculum_track = $10,
           updated_at = NOW()
       WHERE id = $1`,
      [
        session.user.id,
        payload.theme,
        payload.displayName,
        nullableText(payload.avatarUrl),
        payload.profile.age,
        nullableText(payload.profile.gender),
        nullableText(payload.profile.country),
        nullableText(payload.profile.learnerType),
        nullableText(payload.profile.academicYear),
        nullableText(payload.profile.curriculumTrack)
      ]
    );

    sendJson(res, 200, {
      ok: true,
      user: {
        ...session.user,
        displayName: payload.displayName,
        theme: payload.theme,
        avatarUrl: payload.avatarUrl,
        profile: payload.profile
      },
      payload
    });
  } catch (error) {
    sendJson(res, 500, { error: { message: error.message || 'User state request failed.' } });
  }
};

function normalizePayload(payload, fallbackTheme) {
  return {
    mainState: normalizeObject(payload.mainState),
    theme: normalizeTheme(payload.theme || fallbackTheme),
    displayName: normalizeDisplayName(payload.displayName),
    avatarUrl: normalizeAvatarUrl(payload.avatarUrl),
    profile: normalizeProfile(payload.profile)
  };
}

function normalizeIncomingPayload(body, existingPayload, fallbackTheme) {
  const current = normalizePayload(existingPayload, fallbackTheme);
  const nextTheme = body.theme === undefined ? current.theme : normalizeTheme(body.theme || fallbackTheme);
  const nextMainState = body.mainState === undefined ? current.mainState : normalizeObject(body.mainState);
  const nextProfile = body.profile === undefined ? current.profile : normalizeProfile(body.profile);
  const nextDisplayName = body.displayName === undefined ? current.displayName : normalizeDisplayName(body.displayName) || current.displayName;
  const nextAvatarUrl = body.avatarUrl === undefined ? current.avatarUrl : normalizeAvatarUrl(body.avatarUrl);

  return {
    mainState: nextMainState,
    theme: nextTheme,
    displayName: nextDisplayName,
    avatarUrl: nextAvatarUrl,
    profile: nextProfile
  };
}

function normalizeObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTheme(value) {
  const theme = String(value || '').trim();
  return theme || 'lab-noir';
}

function normalizeDisplayName(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  return validateDisplayName(text) ? text : '';
}

function normalizeAvatarUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^data:image\/(?:png|jpeg|jpg|webp|gif|svg\+xml);/i.test(text)) {
    return text.length <= 350000 ? text : '';
  }
  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

function normalizeProfile(value) {
  const profile = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const ageRaw = Number.parseInt(String(profile.age ?? '').trim(), 10);
  const age = Number.isInteger(ageRaw) && ageRaw >= 8 && ageRaw <= 120 ? ageRaw : null;
  const gender = normalizeAllowedValue(profile.gender, ['Male', 'Female', 'Non-binary', 'Prefer not to say']);
  const country = normalizeAllowedValue(profile.country, ['Egypt', 'UK', 'USA', 'France']);
  const learnerType = normalizeAllowedValue(profile.learnerType, ['Free learner', 'High school student', 'University student']);
  const academicYear = normalizeAcademicYear(profile.academicYear, learnerType);
  const curriculumTrack = normalizeAllowedValue(profile.curriculumTrack, [
    'Egypt High School',
    'Egypt University',
    'England High School',
    'England University',
    'United States High School',
    'United States University',
    'France High School',
    'France University'
  ]);

  return {
    age,
    gender,
    country,
    learnerType,
    academicYear,
    curriculumTrack
  };
}

function normalizeAcademicYear(value, learnerType) {
  const optionsByLearnerType = {
    'Free learner': ['Foundation refresher', 'Independent bridge', 'Exam prep'],
    'High school student': ['Year 1', 'Year 2', 'Year 3'],
    'University student': ['Year 1', 'Year 2', 'Year 3', 'Year 4', 'Year 5+']
  };
  return normalizeAllowedValue(value, optionsByLearnerType[learnerType] || []);
}

function normalizeAllowedValue(value, allowed) {
  const text = String(value || '').trim();
  return allowed.includes(text) ? text : '';
}

function nullableText(value) {
  const text = String(value || '').trim();
  return text || null;
}

function hasProfileData(profile) {
  return Boolean(
    profile &&
    (profile.age || profile.gender || profile.country || profile.learnerType || profile.academicYear || profile.curriculumTrack)
  );
}
