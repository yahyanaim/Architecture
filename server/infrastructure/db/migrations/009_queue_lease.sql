-- 009_queue_lease: Worker lease locking for multi-instance distributed queue execution.
-- Portable SQL: enables multiple workers to claim due jobs without double execution.

ALTER TABLE jobs ADD COLUMN locked_by TEXT NULL;
ALTER TABLE jobs ADD COLUMN locked_at TEXT NULL;
