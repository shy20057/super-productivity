import * as nodemailer from 'nodemailer';
import { Logger } from './logger';
import { loadConfigFromEnv, type ServerConfig } from './config';

let transporter: nodemailer.Transporter | null = null;

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporter) return transporter;

  const config = loadConfigFromEnv();

  if (config.smtp) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? {
            user: config.smtp.user,
            pass: config.smtp.pass,
          }
        : undefined,
    });
    Logger.info(`SMTP configured: ${config.smtp.host}:${config.smtp.port}`);
  } else {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SMTP configuration is required in production environments');
    }

    // Fallback to Ethereal for development if no SMTP config
    Logger.warn('No SMTP configuration found. Using Ethereal Email for testing.');
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
    Logger.info(`Ethereal Email configured: ${testAccount.user}`);
  }

  return transporter;
};

interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
}

const sendEmail = async (config: ServerConfig, mail: EmailMessage): Promise<void> => {
  if (config.brevo) {
    let response: Response;
    try {
      response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': config.brevo.apiKey,
          'Content-Type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          sender: { email: config.brevo.fromEmail, name: config.brevo.fromName },
          to: [{ email: mail.to }],
          subject: mail.subject,
          textContent: mail.text,
          htmlContent: mail.html,
        }),
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      });
    } catch {
      // Fetch/header errors can contain the credential value. Never log them.
      throw new Error('Unable to reach Brevo email service');
    }
    // Do not log provider bodies: they may reflect email addresses or login links.
    await response.body?.cancel();
    if (!response.ok) {
      throw new Error(`Brevo email service returned HTTP ${response.status}`);
    }
    Logger.info('Email accepted by Brevo');
    return;
  }

  const mailTransporter = await getTransporter();
  const info = await mailTransporter.sendMail(mail);
  Logger.info(`Email sent: ${info.messageId}`);
  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    Logger.info(`Preview URL: ${previewUrl}`);
  }
};

export const sendVerificationEmail = async (
  to: string,
  token: string,
): Promise<boolean> => {
  try {
    const config = loadConfigFromEnv();
    const from = config.smtp?.from || '"SuperSync" <noreply@example.com>';

    const verificationLink = `${config.publicUrl}/verify-email?token=${token}`;

    await sendEmail(config, {
      from,
      to,
      subject: 'Verify your SuperSync account',
      text:
        `Please verify your account by clicking the following link: ${verificationLink}\n\n` +
        `If clicking the link doesn't work, copy and paste it into your browser.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to SuperSync!</h2>
          <p>Please verify your account by clicking the button below:</p>
          <a
            href="${verificationLink}"
            style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;"
          >
            Verify Email
          </a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #666;">${verificationLink}</p>
        </div>
      `,
    });

    return true;
  } catch (err) {
    Logger.error('Failed to send verification email:', err);
    return false;
  }
};

export const sendPasskeyRecoveryEmail = async (
  to: string,
  token: string,
): Promise<boolean> => {
  try {
    const config = loadConfigFromEnv();
    const from = config.smtp?.from || '"SuperSync" <noreply@example.com>';

    const recoveryLink = `${config.publicUrl}/recover-passkey?token=${token}`;

    await sendEmail(config, {
      from,
      to,
      subject: 'Recover your SuperSync passkey',
      text:
        `You requested to recover your passkey. Click the following link to register a new passkey: ${recoveryLink}\n\n` +
        `If you did not request this, please ignore this email.\n\n` +
        `This link will expire in 1 hour.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Passkey Recovery Request</h2>
          <p>You requested to recover your passkey. Click the button below to register a new passkey:</p>
          <a
            href="${recoveryLink}"
            style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;"
          >
            Register New Passkey
          </a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            If you did not request this, please ignore this email.
          </p>
          <p style="font-size: 12px; color: #666;">
            This link will expire in 1 hour.
          </p>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #666;">${recoveryLink}</p>
        </div>
      `,
    });

    return true;
  } catch (err) {
    Logger.error('Failed to send passkey recovery email:', err);
    return false;
  }
};

export const sendLoginMagicLinkEmail = async (
  to: string,
  token: string,
): Promise<boolean> => {
  try {
    const config = loadConfigFromEnv();
    const from = config.smtp?.from || '"SuperSync" <noreply@example.com>';

    const loginLink = config.webAppUrl
      ? `${config.webAppUrl}/#/account?loginToken=${encodeURIComponent(token)}`
      : `${config.publicUrl}/magic-login?token=${token}`;

    await sendEmail(config, {
      from,
      to,
      subject: 'Your SuperSync login link',
      text:
        `Click the following link to log in to SuperSync: ${loginLink}\n\n` +
        `If you did not request this, please ignore this email.\n\n` +
        `This link will expire in 15 minutes.`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login to SuperSync</h2>
          <p>Click the button below to log in:</p>
          <a
            href="${loginLink}"
            style="display: inline-block; padding: 10px 20px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 5px;"
          >
            Log In
          </a>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            If you did not request this, please ignore this email.
          </p>
          <p style="font-size: 12px; color: #666;">
            This link will expire in 15 minutes.
          </p>
          <p style="margin-top: 20px; font-size: 12px; color: #666;">
            If the button doesn't work, copy and paste this link into your browser:
          </p>
          <p style="font-size: 12px; color: #666;">${loginLink}</p>
        </div>
      `,
    });

    return true;
  } catch (err) {
    Logger.error('Failed to send magic link login email:', err);
    return false;
  }
};
