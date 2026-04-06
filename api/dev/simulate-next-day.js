const {
  applySecurityHeaders,
  buildCorsContext,
  enforceRateLimit,
  sendJson
} = require('../_security');
const { ensureSchema, getPool } = require('../_db');
const {
  getSessionUser,
  ensureUserDailySerialCurrent,
  sanitizeUser
} = require('../_auth');

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

  if (!isLocalDevRequest(req)) {
    sendJson(res, 403, { error: { message: 'This dev-only action is only available on localhost.' } });
    return;
  }

  const rateLimit = enforceRateLimit(req);
  if (!rateLimit.allowed) {
    res.setHeader('Retry-After', String(rateLimit.retryAfterSeconds));
    sendJson(res, 429, { error: { message: 'Too many requests. Please slow down and try again shortly.' } });
    return;
  }

  try {
    await ensureSchema();
    const session = await getSessionUser(req);
    if (!session?.user) {
      sendJson(res, 401, { error: { message: 'You must be signed in to simulate the next day.' } });
      return;
    }

    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const staleResult = await client.query(
        `UPDATE users
         SET daily_serial_date = (CURRENT_DATE - INTERVAL '1 day')::date,
             updated_at = NOW()
         WHERE id = $1
         RETURNING id,
                   account_serial,
                   daily_serial_date,
                   daily_serial,
                   email,
                   display_name,
                   theme,
                   age,
                   gender,
                   country,
                   learner_type,
                   academic_year,
                   curriculum_track,
                   avatar_url`,
        [session.user.id]
      );

      const row = staleResult.rows[0];
      if (!row) {
        await client.query('ROLLBACK');
        sendJson(res, 404, { error: { message: 'Account record not found for this session.' } });
        return;
      }

      const refreshed = await ensureUserDailySerialCurrent(client, row);
      await client.query('COMMIT');
      sendJson(res, 200, {
        ok: true,
        user: sanitizeUser(refreshed)
      });
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {});
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    sendJson(res, 500, { error: { message: error.message || 'Simulate next day failed.' } });
  }
};

function isLocalDevRequest(req) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = (forwardedHost || String(req.headers.host || '').trim()).toLowerCase();
  return /^localhost(?::\d+)?$|^127(?:\.\d{1,3}){3}(?::\d+)?$/.test(host);
}
