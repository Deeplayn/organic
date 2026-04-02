require('./_env');

const { Pool } = require('pg');

let pool;
let schemaReady;

function getPool() {
  if (pool) return pool;

  const connectionString = String(process.env.DATABASE_URL || '').trim();
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured on the server.');
  }

  pool = new Pool({
    connectionString,
    ssl: shouldUseSsl(connectionString) ? { rejectUnauthorized: false } : undefined
  });

  return pool;
}

async function ensureSchema() {
  if (schemaReady) return schemaReady;

  schemaReady = getPool().query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT,
      theme TEXT NOT NULL DEFAULT 'lab-noir',
      account_serial BIGINT,
      age INTEGER,
      gender TEXT,
      country TEXT,
      learner_type TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE SEQUENCE IF NOT EXISTS user_account_serial_seq START WITH 1 INCREMENT BY 1;

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS user_state (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS oauth_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      provider_email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (provider, provider_user_id)
    );

    CREATE INDEX IF NOT EXISTS oauth_identities_user_id_idx ON oauth_identities(user_id);
    CREATE INDEX IF NOT EXISTS oauth_identities_provider_email_idx ON oauth_identities(provider_email);

    ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS account_serial BIGINT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS learner_type TEXT;
    ALTER TABLE users ALTER COLUMN account_serial SET DEFAULT nextval('user_account_serial_seq');
    ALTER TABLE oauth_identities
      ADD COLUMN IF NOT EXISTS provider_email TEXT NOT NULL DEFAULT '';

    UPDATE users
    SET
      age = COALESCE(
        users.age,
        CASE
          WHEN COALESCE(user_state.payload->'profile'->>'age', '') ~ '^[0-9]{1,3}$'
            THEN (user_state.payload->'profile'->>'age')::INTEGER
          ELSE NULL
        END
      ),
      gender = COALESCE(NULLIF(users.gender, ''), NULLIF(user_state.payload->'profile'->>'gender', '')),
      country = COALESCE(NULLIF(users.country, ''), NULLIF(user_state.payload->'profile'->>'country', '')),
      learner_type = COALESCE(NULLIF(users.learner_type, ''), NULLIF(user_state.payload->'profile'->>'learnerType', ''))
    FROM user_state
    WHERE user_state.user_id = users.id;

    DO $$
    DECLARE
      next_serial BIGINT;
    BEGIN
      SELECT COALESCE(MAX(account_serial), 0) + 1 INTO next_serial FROM users;
      PERFORM setval('user_account_serial_seq', GREATEST(next_serial, 1), false);
    END $$;

    UPDATE users
    SET account_serial = nextval('user_account_serial_seq')
    WHERE account_serial IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS users_account_serial_idx ON users(account_serial);
  `);

  return schemaReady;
}

function shouldUseSsl(connectionString) {
  return !/localhost|127\.0\.0\.1/i.test(connectionString);
}

module.exports = {
  getPool,
  ensureSchema
};
