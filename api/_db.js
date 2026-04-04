require('./_env');

const { Pool } = require('pg');

let pool;
let schemaReady;
const ACCOUNT_SERIAL_MIN = 100000000000;
const ACCOUNT_SERIAL_MAX = 999999999999;
const DAILY_SERIAL_MAX = 999999;

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
      daily_serial_date DATE,
      daily_serial TEXT,
      age INTEGER,
      gender TEXT,
      country TEXT,
      learner_type TEXT,
      academic_year TEXT,
      curriculum_track TEXT,
      avatar_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE SEQUENCE IF NOT EXISTS user_account_serial_seq START WITH ${ACCOUNT_SERIAL_MIN + 1} INCREMENT BY 1;

    CREATE TABLE IF NOT EXISTS user_daily_serial_counters (
      serial_date DATE PRIMARY KEY,
      last_value INTEGER NOT NULL DEFAULT 0,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CHECK (last_value >= 0 AND last_value <= ${DAILY_SERIAL_MAX})
    );

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
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_serial_date DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS daily_serial TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS age INTEGER;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS country TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS learner_type TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS academic_year TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS curriculum_track TEXT;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
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
      learner_type = COALESCE(NULLIF(users.learner_type, ''), NULLIF(user_state.payload->'profile'->>'learnerType', '')),
      academic_year = COALESCE(NULLIF(users.academic_year, ''), NULLIF(user_state.payload->'profile'->>'academicYear', '')),
      curriculum_track = COALESCE(NULLIF(users.curriculum_track, ''), NULLIF(user_state.payload->'profile'->>'curriculumTrack', '')),
      avatar_url = COALESCE(NULLIF(users.avatar_url, ''), NULLIF(user_state.payload->>'avatarUrl', ''))
    FROM user_state
    WHERE user_state.user_id = users.id;

    WITH invalid_serial_users AS (
      SELECT
        id,
        ROW_NUMBER() OVER (ORDER BY created_at, id) AS row_num
      FROM users
      WHERE account_serial IS NULL
         OR account_serial < ${ACCOUNT_SERIAL_MIN}
         OR account_serial > ${ACCOUNT_SERIAL_MAX}
    )
    UPDATE users
    SET account_serial = ${ACCOUNT_SERIAL_MIN} + invalid_serial_users.row_num
    FROM invalid_serial_users
    WHERE invalid_serial_users.id = users.id;

    DO $$
    DECLARE
      next_serial BIGINT;
    BEGIN
      SELECT GREATEST(COALESCE(MAX(account_serial), 0) + 1, ${ACCOUNT_SERIAL_MIN + 1}) INTO next_serial FROM users;
      PERFORM setval('user_account_serial_seq', next_serial, false);
    END $$;

    UPDATE users
    SET account_serial = nextval('user_account_serial_seq')
    WHERE account_serial IS NULL;

    WITH existing_daily_serial_max AS (
      SELECT
        daily_serial_date AS serial_date,
        MAX(daily_serial::INTEGER) AS existing_max
      FROM users
      WHERE daily_serial_date IS NOT NULL
        AND daily_serial ~ '^[0-9]{6}$'
      GROUP BY daily_serial_date
    ),
    ranked_daily_serials AS (
      SELECT
        users.id,
        (users.created_at AT TIME ZONE 'UTC')::date AS serial_date,
        LPAD(
          (
            ROW_NUMBER() OVER (
              PARTITION BY (users.created_at AT TIME ZONE 'UTC')::date
              ORDER BY users.created_at, users.id
            ) + COALESCE(existing_daily_serial_max.existing_max, 0)
          )::text,
          6,
          '0'
        ) AS serial_value
      FROM users
      LEFT JOIN existing_daily_serial_max
        ON existing_daily_serial_max.serial_date = (users.created_at AT TIME ZONE 'UTC')::date
      WHERE users.daily_serial_date IS NULL
         OR users.daily_serial IS NULL
         OR users.daily_serial !~ '^[0-9]{6}$'
    )
    UPDATE users
    SET daily_serial_date = ranked_daily_serials.serial_date,
        daily_serial = ranked_daily_serials.serial_value
    FROM ranked_daily_serials
    WHERE ranked_daily_serials.id = users.id
      AND (
        users.daily_serial_date IS DISTINCT FROM ranked_daily_serials.serial_date
        OR users.daily_serial IS DISTINCT FROM ranked_daily_serials.serial_value
      );

    INSERT INTO user_daily_serial_counters (serial_date, last_value, updated_at)
    SELECT daily_serial_date, MAX(daily_serial::INTEGER), NOW()
    FROM users
    WHERE daily_serial_date IS NOT NULL
      AND daily_serial ~ '^[0-9]{6}$'
    GROUP BY daily_serial_date
    ON CONFLICT (serial_date)
    DO UPDATE SET last_value = GREATEST(user_daily_serial_counters.last_value, EXCLUDED.last_value), updated_at = NOW();

    CREATE UNIQUE INDEX IF NOT EXISTS users_account_serial_idx ON users(account_serial);
    CREATE UNIQUE INDEX IF NOT EXISTS users_daily_serial_per_day_idx ON users(daily_serial_date, daily_serial);
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_account_serial_12_digits_chk'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_account_serial_12_digits_chk
          CHECK (account_serial BETWEEN ${ACCOUNT_SERIAL_MIN} AND ${ACCOUNT_SERIAL_MAX});
      END IF;
    END $$;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'users_daily_serial_6_digits_chk'
      ) THEN
        ALTER TABLE users
          ADD CONSTRAINT users_daily_serial_6_digits_chk
          CHECK (daily_serial IS NULL OR daily_serial ~ '^[0-9]{6}$');
      END IF;
    END $$;
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
