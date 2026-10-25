import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const originalEnv = { ...process.env };
const fakeKey = 'test-only-brevo-api-key';
const fetchMock = vi.fn<typeof fetch>();
const smtpTransport = vi.fn();

describe('Brevo API email delivery', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      NODE_ENV: 'test',
      PUBLIC_URL: 'https://sync.example.com',
      BREVO_API_KEY: fakeKey,
      BREVO_FROM_EMAIL: 'sender@example.com',
      BREVO_FROM_NAME: 'Personal tasks',
      SMTP_HOST: 'smtp.example.com',
    };
    delete process.env.WEB_APP_URL;
    fetchMock.mockReset();
    smtpTransport.mockClear();
    vi.stubGlobal('fetch', fetchMock);
    vi.doMock('nodemailer', () => ({
      createTransport: smtpTransport,
      getTestMessageUrl: () => false,
    }));
    fetchMock.mockResolvedValue(
      new Response('{"messageId":"accepted"}', { status: 201 }),
    );
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.doUnmock('nodemailer');
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    ['sendLoginMagicLinkEmail', '/magic-login?token=one-use-token'],
    ['sendVerificationEmail', '/verify-email?token=one-use-token'],
    ['sendPasskeyRecoveryEmail', '/recover-passkey?token=one-use-token'],
  ] as const)(
    'delivers %s through HTTPS with existing email content',
    async (name, link) => {
      const email = await import('../src/email');
      expect(await email[name]('reader@example.com', 'one-use-token')).toBe(true);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, request] = fetchMock.mock.calls[0];
      expect(url).toBe('https://api.brevo.com/v3/smtp/email');
      expect(request).toMatchObject({
        method: 'POST',
        headers: {
          'api-key': fakeKey,
          'Content-Type': 'application/json',
        },
        redirect: 'error',
      });
      expect(request?.signal).toBeInstanceOf(AbortSignal);
      const body = JSON.parse(request?.body as string);
      expect(body.sender).toEqual({
        email: 'sender@example.com',
        name: 'Personal tasks',
      });
      expect(body.to).toEqual([{ email: 'reader@example.com' }]);
      expect(body.subject).toBeTruthy();
      expect(body.htmlContent).toContain(link);
      expect(body.textContent).toContain(link);
      expect(smtpTransport).not.toHaveBeenCalled();
    },
  );

  it('does not expose provider error bodies or fall back to SMTP after rejection', async () => {
    fetchMock.mockResolvedValue(
      new Response(`reflected ${fakeKey} one-use-token`, { status: 401 }),
    );
    const email = await import('../src/email');
    const { Logger } = await import('../src/logger');
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    expect(
      await email.sendLoginMagicLinkEmail('reader@example.com', 'one-use-token'),
    ).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(smtpTransport).not.toHaveBeenCalled();
    expect(logged).toHaveBeenCalled();
    for (const call of logged.mock.calls) {
      const text = call.map(String).join(' ');
      expect(text).not.toContain(fakeKey);
      expect(text).not.toContain('one-use-token');
      expect(text).toContain('401');
    }
  });

  it('sanitizes network/header errors that could contain an API key', async () => {
    fetchMock.mockRejectedValue(new Error(`invalid header ${fakeKey} one-use-token`));
    const email = await import('../src/email');
    const { Logger } = await import('../src/logger');
    const logged = vi.spyOn(Logger, 'error').mockImplementation(() => undefined);
    expect(await email.sendVerificationEmail('reader@example.com', 'one-use-token')).toBe(
      false,
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(logged).toHaveBeenCalled();
    for (const call of logged.mock.calls) {
      const text = call.map(String).join(' ');
      expect(text).not.toContain(fakeKey);
      expect(text).not.toContain('one-use-token');
    }
  });
});
