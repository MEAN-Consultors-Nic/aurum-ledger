import { Injectable, Logger } from '@nestjs/common';
import { FetcherService } from './fetcher.service';

@Injectable()
export class SitemapScanner {
  private readonly logger = new Logger(SitemapScanner.name);

  constructor(private readonly fetcher: FetcherService) {}

  async scan(origin: string) {
    const robots = await this.fetcher.fetch(`${origin}/robots.txt`, 8000);
    const robotsResult = this.parseRobots(robots.ok ? robots.body : undefined);

    const candidateSitemaps = [
      ...robotsResult.sitemapUrls,
      `${origin}/sitemap.xml`,
      `${origin}/sitemap_index.xml`,
    ];

    for (const sitemapUrl of candidateSitemaps) {
      const res = await this.fetcher.fetch(sitemapUrl, 10000);
      if (!res.ok || !res.body || !this.looksLikeXml(res.body)) continue;
      const urls = await this.expandSitemap(res.body);
      if (urls.length === 0) continue;
      const lastModSpread = this.lastModSpread(urls.map((u) => u.lastmod));
      return {
        sitemap: {
          found: true,
          sitemapUrl,
          urlCount: urls.length,
          sampleUrls: urls.slice(0, 10).map((u) => u.loc),
          lastModifiedSpread: lastModSpread,
        },
        robots: robotsResult.summary,
        sampleUrls: urls.slice(0, 50).map((u) => u.loc),
      };
    }

    return {
      sitemap: { found: false },
      robots: robotsResult.summary,
      sampleUrls: [],
    };
  }

  /** Recursively expand sitemap index files into a flat list of URL entries. */
  private async expandSitemap(xml: string): Promise<{ loc: string; lastmod?: string }[]> {
    const isIndex = /<sitemapindex/i.test(xml);
    const locs = this.matchAll(xml, /<loc>([^<]+)<\/loc>/gi);
    const lastmods = this.matchAll(xml, /<lastmod>([^<]+)<\/lastmod>/gi);

    if (!isIndex) {
      return locs.map((loc, i) => ({ loc: loc.trim(), lastmod: lastmods[i]?.trim() }));
    }

    // Follow sub-sitemaps, but cap to avoid hostile sites.
    const all: { loc: string; lastmod?: string }[] = [];
    for (const sub of locs.slice(0, 8)) {
      const subRes = await this.fetcher.fetch(sub.trim(), 10000);
      if (!subRes.ok || !this.looksLikeXml(subRes.body)) continue;
      const subLocs = this.matchAll(subRes.body, /<loc>([^<]+)<\/loc>/gi);
      const subMods = this.matchAll(subRes.body, /<lastmod>([^<]+)<\/lastmod>/gi);
      for (let i = 0; i < subLocs.length; i++) {
        all.push({ loc: subLocs[i].trim(), lastmod: subMods[i]?.trim() });
        if (all.length >= 5000) break;
      }
      if (all.length >= 5000) break;
    }
    return all;
  }

  private parseRobots(body: string | undefined) {
    if (!body) {
      return {
        sitemapUrls: [] as string[],
        summary: { found: false },
      };
    }
    const lines = body.split(/\r?\n/);
    const sitemapUrls: string[] = [];
    const disallowedPaths: string[] = [];
    let userAgent = '*';
    let allowsAll = true;

    for (const line of lines) {
      const cleaned = line.split('#')[0].trim();
      if (!cleaned) continue;
      const [rawKey, ...rest] = cleaned.split(':');
      const key = rawKey.toLowerCase().trim();
      const value = rest.join(':').trim();
      if (!value) continue;

      if (key === 'sitemap') {
        sitemapUrls.push(value);
      } else if (key === 'user-agent') {
        userAgent = value;
      } else if (key === 'disallow' && (userAgent === '*' || userAgent === '')) {
        if (value && value !== '/') disallowedPaths.push(value);
        if (value === '/') allowsAll = false;
      }
    }

    return {
      sitemapUrls,
      summary: {
        found: true,
        allowsAll,
        disallowedPaths: disallowedPaths.slice(0, 12),
      },
    };
  }

  private lastModSpread(values: (string | undefined)[]) {
    const valid = values
      .filter((v): v is string => !!v)
      .map((v) => new Date(v))
      .filter((d) => !isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime());
    if (valid.length === 0) return undefined;
    return {
      earliest: valid[0].toISOString(),
      latest: valid[valid.length - 1].toISOString(),
    };
  }

  private looksLikeXml(body: string) {
    return /<\?xml|<urlset|<sitemapindex/i.test(body);
  }

  private matchAll(input: string, pattern: RegExp): string[] {
    const out: string[] = [];
    let m: RegExpExecArray | null;
    const re = new RegExp(pattern);
    while ((m = re.exec(input)) !== null) {
      out.push(m[1]);
      if (out.length > 10000) break;
    }
    return out;
  }
}
