-- 015_gdpr_compliance: GDPR Right to Erasure, data retention and soft-delete support.
-- Portable SQL for SQLite and PostgreSQL.

ALTER TABLE users ADD COLUMN deleted_at TEXT NULL;
ALTER TABLE users ADD COLUMN purge_due_at TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_users_purge_due ON users(purge_due_at);
