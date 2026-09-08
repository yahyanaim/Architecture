import fs from 'fs';
import path from 'path';

const AUDIT_LOG_PATH = path.join(process.cwd(), 'data', 'audit.log');

// Audit trail (compliance): append-only JSON-lines for security-sensitive
// domain events (`user.registered`, `user.deleted`, `user.account_deleted`).
// Called from controllers AFTER the mutation succeeds, never before. Delivery
// is best-effort by design — persistence failure must never break the user
// request, hence the silent catch. `*.log` is gitignored so trails stay local.
export function audit(event: string, actorId: string, details: Record<string, unknown> = {}): void {
  const entry = {
    timestamp: new Date().toISOString(),
    event,
    actorId,
    ...details,
  };

  const line = JSON.stringify(entry) + '\n';
  console.log('[AUDIT]', JSON.stringify(entry));

  try {
    const dir = path.dirname(AUDIT_LOG_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.appendFileSync(AUDIT_LOG_PATH, line, 'utf-8');
  } catch {
    // fail silently — audit should never break the app
  }
}
