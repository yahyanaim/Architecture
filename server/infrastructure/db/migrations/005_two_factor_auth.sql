-- 005_two_factor_auth: Two-Factor Authentication (2FA / TOTP) schema.
-- Secure RFC 6238 time-based one-time password credentials & recovery codes.

CREATE TABLE IF NOT EXISTS user_two_factor (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  secret TEXT NOT NULL,
  is_enabled INTEGER NOT NULL DEFAULT 0,
  recovery_codes TEXT NOT NULL, -- JSON array of hashed recovery codes
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
