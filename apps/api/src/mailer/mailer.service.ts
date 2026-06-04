import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  cc?: string | string[];
  bcc?: string | string[];
  replyTo?: string;
};

export type SendResult =
  | { ok: true; messageId: string; provider: 'smtp' }
  | { ok: false; provider: 'none'; reason: string }
  | { ok: false; provider: 'smtp'; reason: string };

@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly fromAddress: string;
  private readonly enabled: boolean;

  constructor(config: ConfigService) {
    const host = config.get<string>('SMTP_HOST');
    const port = Number(config.get<string>('SMTP_PORT') ?? 587);
    const user = config.get<string>('SMTP_USER');
    const pass = config.get<string>('SMTP_PASS');
    this.fromAddress =
      config.get<string>('SMTP_FROM') ??
      (user ? `AurumLedger <${user}>` : 'AurumLedger <no-reply@localhost>');

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP not configured (SMTP_HOST / SMTP_USER / SMTP_PASS missing) — emails will be skipped, logged only.',
      );
      this.enabled = false;
      return;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    });
    this.enabled = true;
    this.logger.log(`SMTP transport ready on ${host}:${port}`);
  }

  get isReady() {
    return this.enabled;
  }

  async send(params: SendEmailParams): Promise<SendResult> {
    if (!this.enabled || !this.transporter) {
      return {
        ok: false,
        provider: 'none',
        reason: 'SMTP not configured',
      };
    }
    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        to: params.to,
        cc: params.cc,
        bcc: params.bcc,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
      });
      return { ok: true, messageId: info.messageId, provider: 'smtp' };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Email send failed: ${message}`);
      return { ok: false, provider: 'smtp', reason: message };
    }
  }
}
