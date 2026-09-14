import fs from 'fs';
import path from 'path';
import { Resend } from 'resend';
import { logger } from './observability';
import { RESEND_API_KEY, MAIL_FROM, MAILER_DRIVER } from '../config/index';

// ============================================================================
// Mailer PORT + adapters. Domain/services compose message content; this layer
// only delivers. `LogMailer` (default) writes RFC-ish `.eml` files to
// `data/outbox/` + stdout — perfect for dev/test and a real outbox pattern.
// `ResendMailer` delivers live emails via Resend API in production.
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

export class ResendMailer implements Mailer {
  private resend: Resend;
  private from: string;

  constructor(apiKey = RESEND_API_KEY, from = MAIL_FROM, customClient?: Resend) {
    if (!apiKey && !customClient) {
      throw new Error('RESEND_API_KEY is required for ResendMailer');
    }
    this.resend = customClient ?? new Resend(apiKey);
    this.from = from;
  }

  async send(email: Email): Promise<void> {
    const { data, error } = await this.resend.emails.send({
      from: this.from,
      to: email.to,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    if (error) {
      logger.error('[mail] resend send failed', { error: error.message, to: email.to });
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }

    logger.info('[mail] sent via resend', { id: data?.id, to: email.to, subject: email.subject });
  }
}

/**
 * Mailer factory respecting MAILER_DRIVER setting.
 * When MAILER_DRIVER === 'resend' and RESEND_API_KEY is present, instantiates ResendMailer.
 * Defaults to LogMailer (safe for offline/dev/test).
 */
export function createMailer(): Mailer {
  if (MAILER_DRIVER === 'resend' && RESEND_API_KEY) {
    return new ResendMailer();
  }
  return new LogMailer();
}
