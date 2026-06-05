import { Injectable } from '@nestjs/common';
import { SeoCheck } from '../schemas/site-audit.schema';

type AnalyzeInput = {
  url: string;
  body: string;
  headers: Record<string, string>;
};

type SocialLink = { platform: string; url: string };

@Injectable()
export class HtmlAnalyzer {
  analyze(input: AnalyzeInput) {
    const html = input.body;
    const headers = input.headers;

    const head = this.extract(html, /<head[\s\S]*?<\/head>/i)[0] ?? html.slice(0, 30000);
    const titleMatch = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = this.cleanText(titleMatch?.[1]);

    const description = this.metaContent(head, 'description');
    const canonical = this.linkHref(head, 'canonical');
    const robotsMeta = this.metaContent(head, 'robots');
    const lang = this.attr(html.slice(0, 4000), /<html[^>]*\blang=["']?([^"'\s>]+)/i);

    const hreflang: string[] = [];
    const hreflangRegex = /<link[^>]+rel=["']alternate["'][^>]+hreflang=["']([^"']+)["']/gi;
    let m: RegExpExecArray | null;
    while ((m = hreflangRegex.exec(head)) !== null) {
      hreflang.push(m[1]);
    }

    const openGraph = this.metaCollection(head, 'property', /^og:/i);
    const twitterCard = this.metaCollection(head, 'name', /^twitter:/i);
    const schemaTypes = this.extractSchemaTypes(html);

    const headings = {
      h1: this.countTag(html, 'h1'),
      h2: this.countTag(html, 'h2'),
      h3: this.countTag(html, 'h3'),
    };
    const images = this.countImages(html);
    const social = this.extractSocial(html);
    const stack = this.detectStack(html, headers);

    const checks: SeoCheck[] = this.runSeoChecks({
      title,
      description,
      canonical,
      headings,
      images,
      openGraph,
      twitterCard,
      schemaTypes,
      robotsMeta,
    });

    return {
      title,
      description,
      canonical,
      robotsMeta,
      language: lang,
      hreflang,
      openGraph,
      twitterCard,
      schemaTypes,
      headings,
      images,
      checks,
      social,
      stack,
    };
  }

  /** Pull a small chunk of textual content from the body for AI consumption. */
  extractTextSample(html: string, maxChars = 4000): string {
    // Drop scripts/styles, then strip tags, collapse whitespace.
    const without = html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
    const text = without.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    return text.slice(0, maxChars);
  }

  private metaContent(head: string, nameOrProp: string): string | undefined {
    const a = head.match(
      new RegExp(
        `<meta[^>]+(?:name|property)=["']${this.escapeRegex(nameOrProp)}["'][^>]+content=["']([^"']*)["']`,
        'i',
      ),
    );
    if (a?.[1]) return this.cleanText(a[1]);
    const b = head.match(
      new RegExp(
        `<meta[^>]+content=["']([^"']*)["'][^>]+(?:name|property)=["']${this.escapeRegex(nameOrProp)}["']`,
        'i',
      ),
    );
    return this.cleanText(b?.[1]);
  }

  private metaCollection(
    head: string,
    keyAttr: 'name' | 'property',
    pattern: RegExp,
  ): Record<string, string> {
    const out: Record<string, string> = {};
    const regex = new RegExp(
      `<meta[^>]+${keyAttr}=["']([^"']+)["'][^>]+content=["']([^"']*)["']`,
      'gi',
    );
    let m: RegExpExecArray | null;
    while ((m = regex.exec(head)) !== null) {
      if (pattern.test(m[1])) {
        out[m[1].toLowerCase()] = this.cleanText(m[2]) ?? '';
      }
    }
    return out;
  }

  private linkHref(head: string, rel: string): string | undefined {
    const m = head.match(
      new RegExp(
        `<link[^>]+rel=["']${this.escapeRegex(rel)}["'][^>]+href=["']([^"']+)["']`,
        'i',
      ),
    );
    return this.cleanText(m?.[1]);
  }

  private attr(html: string, regex: RegExp): string | undefined {
    return this.cleanText(html.match(regex)?.[1]);
  }

  private countTag(html: string, tag: string) {
    const re = new RegExp(`<${tag}\\b[^>]*>`, 'gi');
    return (html.match(re) ?? []).length;
  }

  private countImages(html: string) {
    const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
    const withoutAlt = imgs.filter((i) => !/\balt=/i.test(i)).length;
    return { total: imgs.length, withoutAlt };
  }

  private extractSchemaTypes(html: string): string[] {
    const types = new Set<string>();
    const re =
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      try {
        const json = JSON.parse(m[1].trim());
        this.collectTypes(json, types);
      } catch {
        // Some sites emit invalid JSON-LD; ignore.
      }
    }
    return Array.from(types);
  }

  private collectTypes(node: unknown, out: Set<string>) {
    if (Array.isArray(node)) {
      for (const item of node) this.collectTypes(item, out);
      return;
    }
    if (node && typeof node === 'object') {
      const obj = node as Record<string, unknown>;
      const t = obj['@type'];
      if (Array.isArray(t)) t.forEach((v) => typeof v === 'string' && out.add(v));
      else if (typeof t === 'string') out.add(t);
      for (const v of Object.values(obj)) this.collectTypes(v, out);
    }
  }

  private extractSocial(html: string): SocialLink[] {
    const found: SocialLink[] = [];
    const patterns: { platform: string; re: RegExp }[] = [
      { platform: 'facebook', re: /https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/i },
      { platform: 'instagram', re: /https?:\/\/(?:www\.)?instagram\.com\/[A-Za-z0-9._-]+/i },
      { platform: 'x', re: /https?:\/\/(?:www\.)?(?:twitter|x)\.com\/[A-Za-z0-9_]+/i },
      { platform: 'linkedin', re: /https?:\/\/(?:www\.)?linkedin\.com\/(?:company|in)\/[A-Za-z0-9-_]+/i },
      { platform: 'youtube', re: /https?:\/\/(?:www\.)?youtube\.com\/(?:@|c\/|channel\/|user\/)[A-Za-z0-9_-]+/i },
      { platform: 'tiktok', re: /https?:\/\/(?:www\.)?tiktok\.com\/@[A-Za-z0-9._-]+/i },
      { platform: 'github', re: /https?:\/\/(?:www\.)?github\.com\/[A-Za-z0-9_.-]+/i },
      { platform: 'whatsapp', re: /https?:\/\/(?:wa\.me|api\.whatsapp\.com)\/[^"'\s<]+/i },
    ];
    const seen = new Set<string>();
    for (const p of patterns) {
      const m = html.match(p.re);
      if (m && !seen.has(p.platform)) {
        found.push({ platform: p.platform, url: m[0] });
        seen.add(p.platform);
      }
    }
    return found;
  }

  private detectStack(html: string, headers: Record<string, string>) {
    const heuristics: { name: string; confidence: 'high' | 'medium' | 'low' }[] = [];
    const has = (re: RegExp) => re.test(html);
    const header = (k: string) => headers[k.toLowerCase()] ?? '';

    if (has(/\/wp-content\/|wp-includes|wp-emoji/i)) {
      heuristics.push({ name: 'WordPress', confidence: 'high' });
    }
    if (has(/cdn\.shopify\.com|shopify-analytics|x-shopid/i) || /shopify/i.test(header('x-powered-by'))) {
      heuristics.push({ name: 'Shopify', confidence: 'high' });
    }
    if (has(/__NEXT_DATA__|\/_next\/static\//)) {
      heuristics.push({ name: 'Next.js', confidence: 'high' });
    }
    if (has(/window\.__NUXT__|\/_nuxt\//)) {
      heuristics.push({ name: 'Nuxt', confidence: 'high' });
    }
    if (has(/data-reactroot|react-dom|\/_app-/i)) {
      heuristics.push({ name: 'React', confidence: 'medium' });
    }
    if (has(/ng-version=/i)) {
      heuristics.push({ name: 'Angular', confidence: 'high' });
    }
    if (has(/<!--\s*Wix/i) || has(/static\.wixstatic\.com/i)) {
      heuristics.push({ name: 'Wix', confidence: 'high' });
    }
    if (has(/squarespace\.com|sqsp\.net/i)) {
      heuristics.push({ name: 'Squarespace', confidence: 'high' });
    }
    if (has(/webflow\.com|w-webflow/i)) {
      heuristics.push({ name: 'Webflow', confidence: 'high' });
    }
    if (has(/wix\.com|x-wix/i)) {
      heuristics.push({ name: 'Wix', confidence: 'medium' });
    }
    if (has(/drupal\.js|drupal-/i)) {
      heuristics.push({ name: 'Drupal', confidence: 'medium' });
    }
    if (has(/Joomla/i)) {
      heuristics.push({ name: 'Joomla', confidence: 'medium' });
    }

    // CDN / hosting
    const server = header('server') ?? '';
    const cfRay = header('cf-ray');
    const xPoweredBy = header('x-powered-by') ?? '';
    if (cfRay || /cloudflare/i.test(server)) {
      heuristics.push({ name: 'Cloudflare', confidence: 'high' });
    }
    if (header('x-vercel-id') || /vercel/i.test(server)) {
      heuristics.push({ name: 'Vercel', confidence: 'high' });
    }
    if (header('x-nf-request-id') || /netlify/i.test(server)) {
      heuristics.push({ name: 'Netlify', confidence: 'high' });
    }
    if (/^Apache/i.test(server)) heuristics.push({ name: 'Apache', confidence: 'medium' });
    if (/^nginx/i.test(server)) heuristics.push({ name: 'nginx', confidence: 'medium' });
    if (xPoweredBy && !heuristics.some((h) => xPoweredBy.toLowerCase().includes(h.name.toLowerCase()))) {
      heuristics.push({ name: xPoweredBy, confidence: 'low' });
    }

    return { heuristics };
  }

  private runSeoChecks(input: {
    title?: string;
    description?: string;
    canonical?: string;
    headings: { h1: number; h2: number; h3: number };
    images: { total: number; withoutAlt: number };
    openGraph: Record<string, string>;
    twitterCard: Record<string, string>;
    schemaTypes: string[];
    robotsMeta?: string;
  }): SeoCheck[] {
    const titleLen = input.title?.length ?? 0;
    const descLen = input.description?.length ?? 0;
    const hasOg = Object.keys(input.openGraph).length > 0;
    const hasTwitter = Object.keys(input.twitterCard).length > 0;

    return [
      {
        id: 'title-length',
        label: 'Title between 30–65 characters',
        pass: titleLen >= 30 && titleLen <= 65,
        detail: titleLen ? `${titleLen} chars` : 'no <title>',
      },
      {
        id: 'description-length',
        label: 'Meta description between 70–160 characters',
        pass: descLen >= 70 && descLen <= 160,
        detail: descLen ? `${descLen} chars` : 'no description',
      },
      {
        id: 'canonical',
        label: 'Canonical link set',
        pass: !!input.canonical,
      },
      {
        id: 'single-h1',
        label: 'Exactly one <h1>',
        pass: input.headings.h1 === 1,
        detail: `${input.headings.h1} found`,
      },
      {
        id: 'open-graph',
        label: 'Open Graph tags present',
        pass: hasOg,
        detail: hasOg ? `${Object.keys(input.openGraph).length} og:* tags` : undefined,
      },
      {
        id: 'twitter-card',
        label: 'Twitter Card tags present',
        pass: hasTwitter,
      },
      {
        id: 'schema-org',
        label: 'Schema.org JSON-LD present',
        pass: input.schemaTypes.length > 0,
        detail: input.schemaTypes.slice(0, 3).join(', ') || undefined,
      },
      {
        id: 'image-alt',
        label: 'All images have alt text',
        pass: input.images.withoutAlt === 0,
        detail:
          input.images.total === 0
            ? 'no images'
            : `${input.images.withoutAlt}/${input.images.total} missing alt`,
      },
      {
        id: 'robots-meta',
        label: 'Page is indexable (robots meta)',
        pass: !/noindex/i.test(input.robotsMeta ?? ''),
      },
    ];
  }

  private cleanText(s: string | undefined): string | undefined {
    if (!s) return undefined;
    return s
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extract(html: string, re: RegExp): string[] {
    const m = html.match(re);
    return m ?? [];
  }

  private escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
