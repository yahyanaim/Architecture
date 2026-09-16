import { describe, it, expect, vi } from 'vitest';
import { redactPII, logger } from './observability';

describe('Observability PII Redaction', () => {
  it('masks email addresses in plain strings to ***', () => {
    expect(redactPII('user test@example.com logged in')).toBe('user *** logged in');
    expect(redactPII('Multiple: a@b.co and user+tag@domain.org')).toBe('Multiple: *** and ***');
    expect(redactPII('plain text with no emails')).toBe('plain text with no emails');
  });

  it('masks sensitive object keys to ***', () => {
    const input = {
      email: 'john@example.com',
      userEmail: 'alice@corp.com',
      password: 'supersecretpassword',
      secret: 'stripe_sk_123',
      token: 'jwt.token.here',
      name: 'John Doe',
      nested: {
        contactEmail: 'support@example.com',
        apiKey: 'key_live_xyz',
        details: 'reach me at direct@work.com please',
      },
    };

    const redacted = redactPII(input);

    expect(redacted.email).toBe('***');
    expect(redacted.userEmail).toBe('***');
    expect(redacted.password).toBe('***');
    expect(redacted.secret).toBe('***');
    expect(redacted.token).toBe('***');
    expect(redacted.name).toBe('John Doe');
    expect(redacted.nested.contactEmail).toBe('***');
    expect(redacted.nested.apiKey).toBe('***');
    expect(redacted.nested.details).toBe('reach me at *** please');
  });

  it('masks emails in array elements', () => {
    const arr = ['foo', 'admin@nexora.io', { email: 'bar@test.com' }];
    const redacted = redactPII(arr);
    expect(redacted[0]).toBe('foo');
    expect(redacted[1]).toBe('***');
    expect(redacted[2].email).toBe('***');
  });

  it('logger.info outputs redacted line to console.log', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger.info('Invite sent to employee@company.com', {
      recipient: 'employee@company.com',
      secretCode: '123456',
    });

    expect(logSpy).toHaveBeenCalled();
    const loggedJson = JSON.parse(logSpy.mock.calls[0]?.[0] || '{}');
    expect(loggedJson.msg).toBe('Invite sent to ***');
    expect(loggedJson.recipient).toBe('***');
    expect(loggedJson.secretCode).toBe('***');

    logSpy.mockRestore();
  });
});
