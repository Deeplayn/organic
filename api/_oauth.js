require('./_env');

const {
  createId,
  createSession,
  buildSessionCookie,
  sanitizeUser,
  normalizeEmail,
  validateEmail,
  validateDisplayName,
  getAppOrigin,
  sanitizeReturnTo,
  buildAuthPageUrl,
  createOAuthStateCookie,
  readOAuthState,
  buildExpiredOAuthStateCookie,
  USER_SELECT_COLUMNS,
  reserveDailyUserSerial,
  ensureUserDailySerialCurrent
} = require('./_auth');
const { getPool, ensureSchema } = require('./_db');

const PROVIDERS = {
  google: {
    label: 'Google',
    scopes: ['openid', 'email', 'profile'],
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    clientIdEnv: 'GOOGLE_CLIENT_ID',
    clientSecretEnv: 'GOOGLE_CLIENT_SECRET',
    async exchangeProfile({ code, redirectUri, clientId, clientSecret }) {
      const token = await postFormJson('https://oauth2.googleapis.com/token', {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      });

      const profile = await fetchJson('https://openidconnect.googleapis.com/v1/userinfo', {
        headers: {
          Authorization: `Bearer ${token.access_token}`
        }
      });

      const email = normalizeEmail(profile.email);
      if (!validateEmail(email) || profile.email_verified === false) {
        throw new Error('Google did not return a verified email address.');
      }

      return {
        providerUserId: String(profile.sub || ''),
        email,
        displayName: String(profile.name || profile.given_name || email.split('@')[0] || 'Google User').trim()
      };
    }
  },
  microsoft: {
    label: 'Microsoft',
    scopes: ['openid', 'email', 'profile', 'User.Read'],
    clientIdEnv: 'MICROSOFT_CLIENT_ID',
    clientSecretEnv: 'MICROSOFT_CLIENT_SECRET',
    tenantEnv: 'MICROSOFT_TENANT_ID',
    authorizeUrl() {
      const tenant = String(process.env.MICROSOFT_TENANT_ID || 'common').trim() || 'common';
      return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/authorize`;
    },
    tokenUrl() {
      const tenant = String(process.env.MICROSOFT_TENANT_ID || 'common').trim() || 'common';
      return `https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`;
    },
    async exchangeProfile({ code, redirectUri, clientId, clientSecret, provider }) {
      const token = await postFormJson(resolveProviderAuthorize(provider).tokenUrl(), {
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
        scope: resolveProviderAuthorize(provider).scopes.join(' ')
      });

      // Microsoft accounts do not always populate Graph `mail`, so prefer
      // token claims first and only use Graph as a supplemental profile source.
      const tokenClaims = parseJwtClaims(token.id_token);
      const profile = await fetchMicrosoftProfile(token.access_token);
      const email = normalizeEmail(
        profile.mail ||
        profile.userPrincipalName ||
        tokenClaims.email ||
        tokenClaims.preferred_username ||
        tokenClaims.upn
      );
      if (!validateEmail(email)) {
        throw new Error('Microsoft did not return a usable email address.');
      }

      return {
        providerUserId: String(profile.id || tokenClaims.oid || tokenClaims.sub || ''),
        email,
        displayName: String(
          profile.displayName ||
          tokenClaims.name ||
          tokenClaims.preferred_username ||
          email.split('@')[0] ||
          'Microsoft User'
        ).trim()
      };
    }
  }
};

function resolveProviderAuthorize(provider) {
  const config = PROVIDERS[provider];
  if (!config) {
    throw new Error('Unsupported OAuth provider.');
  }
  return config;
}

function getProviderConfig(provider) {
  const config = resolveProviderAuthorize(provider);
  const clientId = String(process.env[config.clientIdEnv] || '').trim();
  const clientSecret = String(process.env[config.clientSecretEnv] || '').trim();
  const missing = [];
  if (!clientId) missing.push(config.clientIdEnv);
  if (!clientSecret) missing.push(config.clientSecretEnv);
  if (missing.length) {
    throw new Error(`${config.label} OAuth is not configured on the server. Missing ${missing.join(' and ')}.`);
  }
  return {
    ...config,
    clientId,
    clientSecret
  };
}

function buildProviderStartUrl(req, provider, returnTo) {
  const config = getProviderConfig(provider);
  const origin = getAppOrigin(req);
  const redirectUri = new URL(`/api/auth/oauth/callback?provider=${encodeURIComponent(provider)}`, `${origin}/`).toString();
  const { state, cookie } = createOAuthStateCookie(req, {
    provider,
    returnTo: sanitizeReturnTo(returnTo, origin)
  });
  const authorizeUrl = new URL(typeof config.authorizeUrl === 'function' ? config.authorizeUrl() : config.authorizeUrl);
  authorizeUrl.searchParams.set('client_id', config.clientId);
  authorizeUrl.searchParams.set('redirect_uri', redirectUri);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('scope', config.scopes.join(' '));
  authorizeUrl.searchParams.set('state', state);
  if (provider === 'google') authorizeUrl.searchParams.set('access_type', 'online');
  return {
    location: authorizeUrl.toString(),
    cookie
  };
}

async function completeProviderLogin(req, provider, params) {
  const config = getProviderConfig(provider);
  const origin = getAppOrigin(req);
  const oauthState = readOAuthState(req, provider, params.get('state'));
  const redirectUri = new URL(`/api/auth/oauth/callback?provider=${encodeURIComponent(provider)}`, `${origin}/`).toString();
  const profile = await config.exchangeProfile({
    code: params.get('code'),
    redirectUri,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    provider
  });

  if (!profile.providerUserId) {
    throw new Error(`${config.label} did not return a valid account identifier.`);
  }

  const user = await findOrCreateOAuthUser(provider, profile);
  const session = await createSession(req, user.id);

  return {
    user,
    returnTo: oauthState.returnTo,
    cookies: [
      buildSessionCookie(req, session.sessionId, session.expiresAt),
      buildExpiredOAuthStateCookie(req)
    ]
  };
}

function buildOAuthErrorRedirect(req, message, returnTo = '') {
  const location = buildAuthPageUrl(req, {
    mode: 'login',
    message,
    returnTo
  });
  return {
    location,
    cookie: buildExpiredOAuthStateCookie(req)
  };
}

async function findOrCreateOAuthUser(provider, profile) {
  await ensureSchema();
  const pool = getPool();
  const email = normalizeEmail(profile.email);
  if (!validateEmail(email)) {
    throw new Error('A valid email address is required for OAuth sign-in.');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const identityResult = await client.query(
      `SELECT users.id,
              users.account_serial,
              users.daily_serial_date,
              users.daily_serial,
              users.email,
              users.display_name,
              users.theme,
              users.age,
              users.gender,
              users.country,
              users.learner_type
       FROM oauth_identities
       JOIN users ON users.id = oauth_identities.user_id
       WHERE oauth_identities.provider = $1 AND oauth_identities.provider_user_id = $2
       LIMIT 1`,
      [provider, String(profile.providerUserId)]
    );
    if (identityResult.rows[0]) {
      const currentUser = await ensureUserDailySerialCurrent(client, identityResult.rows[0]);
      await client.query('COMMIT');
      return sanitizeUser(currentUser);
    }

    let userRow;
    const existingUser = await client.query(
      `SELECT ${USER_SELECT_COLUMNS}
       FROM users
       WHERE email = $1
       LIMIT 1`,
      [email]
    );

    if (existingUser.rows[0]) {
      userRow = await ensureUserDailySerialCurrent(client, existingUser.rows[0]);
    } else {
      const userId = createId('user');
      const displayName = validateDisplayName(profile.displayName) ? profile.displayName.trim() : email.split('@')[0];
      const dailySerial = await reserveDailyUserSerial(client);
      const insertedUser = await client.query(
        `INSERT INTO users (id, email, display_name, password_hash, daily_serial_date, daily_serial)
         VALUES ($1, $2, $3, NULL, $4::date, $5)
         RETURNING ${USER_SELECT_COLUMNS}`,
        [userId, email, displayName, dailySerial.dailySerialDate, dailySerial.dailySerial]
      );
      await client.query(
        'INSERT INTO user_state (user_id, payload) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING',
        [userId, JSON.stringify({})]
      );
      userRow = insertedUser.rows[0];
    }

    await client.query(
      `INSERT INTO oauth_identities (id, user_id, provider, provider_user_id, provider_email)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (provider, provider_user_id)
       DO UPDATE SET provider_email = EXCLUDED.provider_email, updated_at = NOW()`,
      [createId('oauth'), userRow.id, provider, String(profile.providerUserId), email]
    );

    await client.query('COMMIT');
    return sanitizeUser(userRow);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

async function postFormJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      ...extraHeaders
    },
    body: new URLSearchParams(body)
  });
  const data = await parseResponseData(response);
  if (!response.ok || data?.error) {
    throw new Error(data?.error_description || data?.error?.message || data?.error || 'OAuth token exchange failed.');
  }
  if (!data?.access_token) {
    throw new Error('OAuth token exchange did not return an access token.');
  }
  return data;
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.headers || {})
    }
  });
  const data = await parseResponseData(response);
  if (!response.ok) {
    throw new Error(data?.error_description || data?.message || 'OAuth profile request failed.');
  }
  return data;
}

async function fetchMicrosoftProfile(accessToken) {
  if (!accessToken) {
    return {};
  }

  try {
    return await fetchJson('https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName', {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
  } catch {
    return {};
  }
}

function parseJwtClaims(token) {
  const raw = String(token || '').trim();
  if (!raw) {
    return {};
  }

  const parts = raw.split('.');
  if (parts.length < 2) {
    return {};
  }

  try {
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    const parsed = JSON.parse(payload);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

async function parseResponseData(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return Object.fromEntries(new URLSearchParams(text));
  }
}

module.exports = {
  getProviderConfig,
  buildProviderStartUrl,
  completeProviderLogin,
  buildOAuthErrorRedirect
};
