import { Injectable } from '@nestjs/common';
import * as Handlebars from 'handlebars';

export type RenderResult = {
  subject: string;
  html: string;
  text: string;
};

@Injectable()
export class TemplateRendererService {
  private readonly subjectCache = new Map<string, Handlebars.TemplateDelegate>();
  private readonly bodyCache = new Map<string, Handlebars.TemplateDelegate>();

  constructor() {
    Handlebars.registerHelper('money', (amount: number, currency = 'USD') => {
      if (typeof amount !== 'number') return '';
      return `${currency} ${amount.toFixed(2)}`;
    });
    Handlebars.registerHelper('date', (value: Date | string | undefined) => {
      if (!value) return '';
      const d = typeof value === 'string' ? new Date(value) : value;
      if (Number.isNaN(d.getTime())) return '';
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    });
    Handlebars.registerHelper('uppercase', (s: string) => String(s ?? '').toUpperCase());
  }

  render(template: { subject: string; bodyHtml: string; bodyText?: string }, ctx: Record<string, unknown>): RenderResult {
    const subject = this.compile('subject', template.subject)(ctx);
    const html = this.compile('html', template.bodyHtml)(ctx);
    const text =
      template.bodyText && template.bodyText.trim().length > 0
        ? this.compile('text', template.bodyText)(ctx)
        : this.htmlToText(html);
    return { subject, html: this.wrapHtml(html, subject), text };
  }

  // Returns a sample context for a given event key (for preview / test send)
  sampleContextFor(eventKey?: string): Record<string, unknown> {
    return {
      client: { name: 'Acme Corp', email: 'admin@acme.example' },
      contract: {
        title: 'Annual hosting',
        amount: 240,
        currency: 'USD',
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
        billingPeriod: 'annual',
      },
      service: { name: 'Web Hosting' },
      project: {
        name: 'Acme hosting setup',
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      task: {
        title: 'Configure SSL',
        dueDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        priority: 'high',
      },
      plannedIncome: { name: 'Monthly retainer' },
      expense: { name: 'AWS bill' },
      subscription: { name: 'Adobe Creative Cloud' },
      loan: { name: 'Office equipment' },
      amount: 120,
      currency: 'USD',
      balance: 120,
      date: new Date(),
      daysUntilExpiry: 15,
      daysUntilDue: 7,
      daysOverdue: 2,
      eventKey,
    };
  }

  private compile(kind: 'subject' | 'html' | 'text', source: string): Handlebars.TemplateDelegate {
    const cache = kind === 'subject' ? this.subjectCache : this.bodyCache;
    const cacheKey = `${kind}::${source}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;
    const compiled = Handlebars.compile(source, { noEscape: kind === 'html' });
    cache.set(cacheKey, compiled);
    return compiled;
  }

  private htmlToText(html: string): string {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private wrapHtml(html: string, subject: string): string {
    return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Helvetica,Arial,sans-serif;color:#0f172a;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 2px rgba(15,23,42,0.05);max-width:600px;">
<tr><td style="padding:32px;">
<div style="font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#64748b;margin-bottom:18px;">Helm</div>
${html}
<div style="margin-top:32px;padding-top:18px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;">
Automated notification from Helm.
</div>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`;
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
