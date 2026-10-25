import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';

const originalEnv = { ...process.env };

const resetEnv = (): void => {
  process.env = { ...originalEnv };
};

describe('Email transport configuration', () => {
  beforeEach(() => {
    resetEnv();
    vi.resetModules();
  });

  afterEach(() => {
    resetEnv();
  });

  it('should fail gracefully in production without SMTP configuration', async () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_URL = 'https://example.com';

    const { sendVerificationEmail } = await import('../src/email');
    const result = await sendVerificationEmail('user@test.com', 'token');
    expect(result).toBe(false);
  });
});

describe('Email login callback', () => {
  const sendMail = vi.fn().mockResolvedValue({ messageId: 'test-message' });

  beforeEach(() => {
    resetEnv();
    vi.resetModules();
    sendMail.mockClear();
    process.env.NODE_ENV = 'test';
    process.env.PUBLIC_URL = 'https://sync.example.com';
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.CORS_ORIGINS = 'https://app.example.com';
    delete process.env.WEB_APP_URL;
    delete process.env.CORS_ENABLED;
    // Keep real config and email rendering; replace only the external SMTP transport.
    vi.doMock('nodemailer', () => ({
      createTransport: () => ({ sendMail }),
      getTestMessageUrl: () => false,
    }));
  });

  afterEach(() => {
    resetEnv();
    vi.doUnmock('nodemailer');
  });

  it('sends the existing server login URL when WEB_APP_URL is unset', async () => {
    const { sendLoginMagicLinkEmail } = await import('../src/email');
    expect(await sendLoginMagicLinkEmail('user@test.com', 'one-time-token')).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.text).toContain(
      'https://sync.example.com/magic-login?token=one-time-token',
    );
    expect(mail.html).toContain(
      'href="https://sync.example.com/magic-login?token=one-time-token"',
    );
  });

  it('sends an encoded one-time token to the configured frontend account route', async () => {
    process.env.WEB_APP_URL = 'https://app.example.com/';
    const { sendLoginMagicLinkEmail } = await import('../src/email');
    expect(await sendLoginMagicLinkEmail('user@test.com', 'one/+?&=# token')).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    const link =
      'https://app.example.com/#/account?loginToken=one%2F%2B%3F%26%3D%23%20token';
    expect(mail.text).toContain(link);
    expect(mail.html).toContain(`href="${link}"`);
    expect(mail.text).not.toContain('/magic-login');
  });

  it('keeps registration verification on the server with a frontend configured', async () => {
    process.env.WEB_APP_URL = 'https://app.example.com';
    const { sendVerificationEmail } = await import('../src/email');
    expect(await sendVerificationEmail('user@test.com', 'registration-token')).toBe(true);
    const mail = sendMail.mock.calls[0][0];
    expect(mail.text).toContain(
      'https://sync.example.com/verify-email?token=registration-token',
    );
    expect(mail.html).toContain(
      'href="https://sync.example.com/verify-email?token=registration-token"',
    );
  });
});
