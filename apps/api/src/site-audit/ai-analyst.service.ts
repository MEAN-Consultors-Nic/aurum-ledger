import { Injectable, Logger } from '@nestjs/common';
import { OpenAiService } from './openai/openai.service';
import { SiteAuditDocument, SuggestedLineItem } from './schemas/site-audit.schema';

@Injectable()
export class AiAnalystService {
  private readonly logger = new Logger(AiAnalystService.name);

  constructor(private readonly openai: OpenAiService) {}

  get isReady() {
    return this.openai.isReady;
  }

  async executiveSummary(
    findings: SiteAuditDocument['findings'],
    contentSample: string,
  ): Promise<string> {
    const facts = this.summarizeFacts(findings, contentSample);
    return this.openai.chat(
      [
        {
          role: 'system',
          content:
            'You are a senior digital consultant from a Nicaraguan consultancy preparing a redesign/revamp proposal for an internal partner. Write tight, candid prose in Spanish (Nicaragua). No marketing fluff, no bullet lists, no preambles. Aim for 4 short paragraphs.',
        },
        {
          role: 'user',
          content: `Resumí el estado actual del sitio y la oportunidad de un revamp. Apoyate exclusivamente en los datos abajo. Estructura:
- Párrafo 1: qué es el sitio y en qué stack está.
- Párrafo 2: qué tan saludable está hoy (performance, SEO, contenido).
- Párrafo 3: las 2–3 brechas más caras que tiene.
- Párrafo 4: la dirección recomendada del revamp.

DATOS:
${facts}`,
        },
      ],
      { temperature: 0.45, maxTokens: 900 },
    );
  }

  async stackReasoning(
    findings: SiteAuditDocument['findings'],
    headers: Record<string, string>,
    htmlHead: string,
  ): Promise<string> {
    const heur = findings.stack?.heuristics ?? [];
    return this.openai.chat(
      [
        {
          role: 'system',
          content:
            'You are a senior full-stack engineer doing technology fingerprinting from raw HTTP response data. Output 2–4 short Spanish sentences. State the most likely stack (CMS / framework / hosting / CDN / analytics), level of confidence, and any odd signals worth flagging. No bullet lists.',
        },
        {
          role: 'user',
          content: `Heurísticas iniciales: ${heur.map((h) => `${h.name} (${h.confidence})`).join(', ') || 'ninguna'}.

HEADERS:
${this.compactHeaders(headers)}

HEAD HTML (primeros 4000 chars):
${htmlHead.slice(0, 4000)}`,
        },
      ],
      { temperature: 0.3, maxTokens: 350 },
    );
  }

  async visualCritique(screenshotUrl: string): Promise<string> {
    return this.openai.chat(
      [
        {
          role: 'system',
          content:
            'You are a senior product designer doing a first-impression critique. Output 5 short Spanish bullets. Each bullet starts with a category between brackets like [Layout], [Tipografía], [Color], [Jerarquía], [Above the fold], [Imágenes], [CTA], [Confianza]. Be concrete and brutal but professional. No preamble.',
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Critica la home a partir de este screenshot. ¿Qué problemas le saltarían a un cliente que ve esto por primera vez?',
            },
            { type: 'image_url', image_url: { url: screenshotUrl } },
          ],
        },
      ],
      { model: this.openai.visionModel, temperature: 0.5, maxTokens: 500 },
    );
  }

  async contentAnalysis(
    homepageText: string,
    interiorTexts: { url: string; text: string }[],
  ): Promise<string> {
    const interior = interiorTexts
      .slice(0, 3)
      .map((p) => `--- ${p.url} ---\n${p.text.slice(0, 1200)}`)
      .join('\n\n');

    return this.openai.chat(
      [
        {
          role: 'system',
          content:
            'You are a senior content strategist. Output Spanish, 4 short bullets. Each bullet starts with a category between brackets: [Propuesta de valor], [Claridad], [Audiencia], [Llamados a la acción], [Tono], [SEO de contenido]. Be honest. No preamble.',
        },
        {
          role: 'user',
          content: `Evaluá el contenido del sitio. Páginas analizadas:

HOMEPAGE (texto extraído):
${homepageText.slice(0, 2500)}

PÁGINAS INTERIORES:
${interior || '(no se pudieron leer páginas interiores)'}`,
        },
      ],
      { temperature: 0.4, maxTokens: 600 },
    );
  }

  async suggestedLineItems(
    findings: SiteAuditDocument['findings'],
    executiveSummary: string,
  ): Promise<SuggestedLineItem[]> {
    const facts = this.summarizeFacts(findings, '');
    const result = await this.openai.chatJson<{ items: SuggestedLineItem[] }>(
      [
        {
          role: 'system',
          content: `You are pricing a website redesign engagement for MEAN Consultors (Nicaragua, USD). Output a strict JSON object: { "items": [{ "title": string, "description": string, "hours": number, "category": "design" | "development" | "seo" | "performance" | "content" | "other" }] }. Hours must be realistic integers between 4 and 120. Include 5 to 9 items. Titles in Spanish. Descriptions are one short Spanish sentence each. No prose outside JSON.`,
        },
        {
          role: 'user',
          content: `Datos del sitio:
${facts}

Resumen ejecutivo previo:
${executiveSummary.slice(0, 1200)}

Propuesta de un revamp completo. Asegurate de cubrir: discovery/UX, diseño, desarrollo (frontend + CMS si aplica), SEO técnico, performance, contenido, QA y deployment.`,
        },
      ],
      { temperature: 0.5, maxTokens: 1200 },
    );
    const items = result?.items ?? [];
    return items
      .filter((i) => i && typeof i.title === 'string' && typeof i.hours === 'number')
      .map((i) => ({
        title: i.title.trim(),
        description: i.description?.trim(),
        hours: Math.max(1, Math.min(200, Math.round(i.hours))),
        category: i.category,
      }));
  }

  private summarizeFacts(findings: SiteAuditDocument['findings'], content: string) {
    const parts: string[] = [];
    if (findings.homepage) {
      parts.push(
        `Homepage: status ${findings.homepage.status ?? '?'}, ${findings.homepage.responseMs ?? '?'} ms, ${findings.homepage.contentLength ?? 0} bytes, title="${findings.homepage.title ?? ''}"`,
      );
    }
    if (findings.stack?.heuristics?.length) {
      parts.push(
        `Stack heurísticas: ${findings.stack.heuristics.map((h) => `${h.name}(${h.confidence})`).join(', ')}`,
      );
    }
    if (findings.sitemap) {
      parts.push(
        findings.sitemap.found
          ? `Sitemap: ${findings.sitemap.urlCount ?? 0} URLs en ${findings.sitemap.sitemapUrl}`
          : 'Sitemap: no encontrado',
      );
    }
    if (findings.whois?.ageYears !== undefined) {
      parts.push(`Dominio: ${findings.whois.ageYears} años de antigüedad, registrado en ${findings.whois.registered ?? '?'}`);
    }
    if (findings.ssl?.daysRemaining !== undefined) {
      parts.push(`SSL: ${findings.ssl.daysRemaining} días restantes, emisor ${findings.ssl.issuer ?? '?'}`);
    }
    if (findings.pageSpeed?.mobile) {
      const m = findings.pageSpeed.mobile;
      parts.push(
        `PageSpeed mobile — performance ${m.performance ?? '?'}, SEO ${m.seo ?? '?'}, accessibility ${m.accessibility ?? '?'}, LCP ${m.lcp ?? '?'} ms, CLS ${m.cls ?? '?'}, INP ${m.inp ?? '?'} ms`,
      );
      if (m.topOpportunities?.length) {
        parts.push(
          `Oportunidades top: ${m.topOpportunities.slice(0, 4).map((o) => o.title).join(' · ')}`,
        );
      }
    }
    if (findings.pageSpeed?.desktop) {
      const d = findings.pageSpeed.desktop;
      parts.push(
        `PageSpeed desktop — performance ${d.performance ?? '?'}, SEO ${d.seo ?? '?'}`,
      );
    }
    if (findings.seo) {
      const failing = findings.seo.checks.filter((c) => !c.pass).map((c) => c.label);
      parts.push(
        `SEO básico falla en: ${failing.join('; ') || 'nada destacable'}.`,
      );
      parts.push(
        `Estructura: h1=${findings.seo.headings?.h1 ?? 0}, h2=${findings.seo.headings?.h2 ?? 0}, imágenes ${findings.seo.images?.total ?? 0} (${findings.seo.images?.withoutAlt ?? 0} sin alt).`,
      );
      if (findings.seo.schemaTypes.length) {
        parts.push(`Schema.org: ${findings.seo.schemaTypes.join(', ')}`);
      }
    }
    if (findings.social?.length) {
      parts.push(
        `Presencia social: ${findings.social.map((s) => s.platform).join(', ')}`,
      );
    } else {
      parts.push('Presencia social: no se detectaron links a redes sociales.');
    }
    if (content) {
      parts.push(`Texto homepage (muestra): ${content.slice(0, 1200)}`);
    }
    return parts.join('\n');
  }

  private compactHeaders(headers: Record<string, string>) {
    const interesting = [
      'server',
      'x-powered-by',
      'x-generator',
      'cf-ray',
      'x-vercel-id',
      'x-nf-request-id',
      'x-shopid',
      'set-cookie',
      'content-type',
      'strict-transport-security',
    ];
    return interesting
      .map((k) => (headers[k] ? `${k}: ${headers[k].slice(0, 160)}` : null))
      .filter(Boolean)
      .join('\n');
  }
}
