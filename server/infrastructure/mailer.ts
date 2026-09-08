import fs from 'fs';
import path from 'path';
import { logger } from './observability';

// ============================================================================
// Mailer PORT + adapters. Domain/services compose message content; this layer
// only delivers. `LogMailer` (default) writes RFC-ish `.eml` files to
// `data/outbox/` + stdout — perfect for dev/test and a real outbox pattern.
// For prod, implement `SmtpMailer` (or Resend/SES client) against THIS
// interface and swap one line in `SharedUserRepository`. Never import
// providers into services/controllers.
// ============================================================================

export interface Email {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface Mailer {
  send(email: Email): Promise<void>;
}

export class LogMailer implements Mailer {
  async send(email: Email): Promise<void> {
    const dir = path.join(process.cwd(), 'data', 'outbox');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2)}.eml`);
    fs.writeFileSync(
      file,
      `To: ${email.to}\nSubject: ${email.subject}\nDate: ${new Date().toUTCString()}\n\n${email.text}\n`
    );
    logger.info('[mail] queued to outbox', { to: email.to, subject: email.subject, file });
  }
}
