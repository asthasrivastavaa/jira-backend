import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// Anything a user typed (names) must be escaped before it goes into email HTML
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;

  constructor(config: ConfigService) {
    this.transporter = createTransport({
      host: config.getOrThrow<string>('SMTP_HOST'),
      port: config.getOrThrow<number>('SMTP_PORT'),
      secure: false,
    });
    this.from = config.getOrThrow<string>('MAIL_FROM');
  }

  async send(to: string, subject: string, html: string) {
    await this.transporter.sendMail({ from: this.from, to, subject, html });
  }

  sendOtp(to: string, code: string, purpose: 'verify' | 'reset' | 'email-change') {
    const titles = {
      verify: 'Verify your email',
      reset: 'Reset your password',
      'email-change': 'Confirm your new email',
    };
    const html = `
      <div style="font-family:sans-serif;max-width:420px;margin:auto">
        <h2>${titles[purpose]}</h2>
        <p>Your code is:</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold">${code}</p>
        <p style="color:#666">It expires in 1 minute. If you didn't request it, ignore this email.</p>
      </div>`;
    return this.send(to, `${code} is your code`, html);
  }

  sendInvite(to: string, p: { workspaceName: string; inviterName: string; role: string; link: string }) {
    const html = `
      <div style="font-family:sans-serif;max-width:460px;margin:auto">
        <h2>You're invited to join ${escapeHtml(p.workspaceName)}</h2>
        <p>${escapeHtml(p.inviterName)} invited you to the workspace <strong>${escapeHtml(p.workspaceName)}</strong>
           as <strong>${escapeHtml(p.role)}</strong>.</p>
        <p style="margin:28px 0">
          <a href="${p.link}" style="background:#2563eb;color:#fff;padding:12px 22px;border-radius:8px;text-decoration:none;font-weight:600">
            Accept invitation
          </a>
        </p>
        <p style="color:#666;font-size:13px">This link works once and expires in 7 days. If you weren't expecting it, ignore this email.</p>
      </div>`;
    return this.send(to, `${p.inviterName} invited you to ${p.workspaceName}`, html);
  }
}
