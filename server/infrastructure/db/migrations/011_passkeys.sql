-- 011_passkeys: WebAuthn / FIDO2 Passkeys credentials storage.
-- Enables passwordless login and multi-factor hardware security.

CREATE TABLE IF NOT EXISTS passkey_credentials (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL DEFAULT 0,
  device_type TEXT NOT NULL DEFAULT 'singleDevice',
  backed_up INTEGER NOT NULL DEFAULT 0,
  transports TEXT NULL,
  name TEXT NOT NULL DEFAULT 'Passkey',
  created_at TEXT NOT NULL,
  last_used_at TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_passkey_credentials_user_id ON passkey_credentials(user_id);
