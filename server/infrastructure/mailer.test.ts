import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { LogMailer, ResendMailer, createMailer } from './mailer';

describe('Mailer Port & Adapters', () => {
  const outboxDir = path.resolve(process.cwd(), 'data', 'outbox');

  beforeEach(() => {
    if (fs.existsSync(outboxDir)) {
      const files = fs.readdirSync(outboxDir);
      for (const f of files) {
        if (f.endsWith('.eml')) {
          fs.unlinkSync(path.join(outboxDir, f));
        }
      }
    }
  });

  describe('LogMailer', () => {
    it('writes RFC-style .eml files to data/outbox in dev/test', async () => {
      const mailer = new LogMailer();
      await mailer.send({
        to: 'recipient@example.com',
        subject: 'Welcome to Nexora',
        text: 'Hello, your workspace is ready!',
      });

      expect(fs.existsSync(outboxDir)).toBe(true);
      const files = fs.readdirSync(outboxDir).filter((f) => f.endsWith('.eml'));
      expect(files.length).toBeGreaterThan(0);

      const content = fs.readFileSync(path.join(outboxDir, files[0]!), 'utf-8');
      expect(content).toContain('To: recipient@example.com');
      expect(content).toContain('Subject: Welcome to Nexora');
      expect(content).toContain('Hello, your workspace is ready!');
    });
  });

  describe('ResendMailer', () => {
    it('dispatches email via Resend API client with configured sender and payload', async () => {
      const mockResend = {
        emails: {
          send: vi.fn().mockResolvedValue({
            data: { id: 're_123456789' },
            error: null,
          }),
        },
      };

      const mailer = new ResendMailer('re_test_key', 'system@example.com', mockResend as any);
      await mailer.send({
        to: 'user@example.com',
        subject: 'Password Reset',
        text: 'Reset your password: https://example.com/reset',
        html: '<p>Reset your password</p>',
      });

      expect(mockResend.emails.send).toHaveBeenCalledWith({
        from: 'system@example.com',
        to: 'user@example.com',
        subject: 'Password Reset',
        text: 'Reset your password: https://example.com/reset',
        html: '<p>Reset your password</p>',
      });
    });

    it('throws when Resend API returns an error', async () => {
      const mockResend = {
        emails: {
          send: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Domain not verified' },
          }),
        },
      };

      const mailer = new ResendMailer('re_test_key', 'system@example.com', mockResend as any);
      await expect(
        mailer.send({
          to: 'user@example.com',
          subject: 'Test',
          text: 'Fails',
        })
      ).rejects.toThrow('Resend email delivery failed: Domain not verified');
    });

    it('requires an API key when instantiated directly without mock', () => {
      expect(() => new ResendMailer('', 'system@example.com')).toThrow(
        'RESEND_API_KEY is required for ResendMailer'
      );
    });
  });

  describe('createMailer Factory', () => {
    it('returns LogMailer by default when MAILER_DRIVER is unset or log', () => {
      const mailer = createMailer();
      expect(mailer).toBeInstanceOf(LogMailer);
    });
  });
});
