import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PageSpeedSnapshot } from '../schemas/site-audit.schema';

const API_BASE =
  'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';

@Injectable()
export class PageSpeedService {
  private readonly logger = new Logger(PageSpeedService.name);
  private readonly apiKey?: string;

  constructor(config: ConfigService) {
    // Optional. Public API works without a key for low volume.
    this.apiKey = config.get<string>('PAGESPEED_API_KEY') || undefined;
  }

  async run(url: string, strategy: 'mobile' | 'desktop'): Promise<PageSpeedSnapshot | undefined> {
    const params = new URLSearchParams({
      url,
      strategy,
    });
    for (const category of ['performance', 'seo', 'accessibility', 'best-practices']) {
      params.append('category', category);
    }
    if (this.apiKey) params.set('key', this.apiKey);

    try {
      const res = await fetch(`${API_BASE}?${params.toString()}`, {
        signal: AbortSignal.timeout(45000),
      });
      if (!res.ok) {
        this.logger.warn(`PageSpeed ${strategy} ${res.status} for ${url}`);
        return undefined;
      }
      const data = (await res.json()) as PageSpeedApiResponse;
      const cats = data.lighthouseResult?.categories ?? {};
      const audits = data.lighthouseResult?.audits ?? {};

      const topOpportunities = Object.values(audits)
        .filter((a) => a?.details?.type === 'opportunity' && a?.numericValue)
        .map((a) => ({
          id: a.id,
          title: a.title,
          savingsMs: Math.round(a.numericValue ?? 0),
        }))
        .sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0))
        .slice(0, 6);

      return {
        performance: pct(cats.performance?.score),
        seo: pct(cats.seo?.score),
        accessibility: pct(cats.accessibility?.score),
        bestPractices: pct(cats['best-practices']?.score),
        lcp: numeric(audits['largest-contentful-paint']),
        cls: numericExact(audits['cumulative-layout-shift']),
        inp: numeric(audits['interaction-to-next-paint']),
        fcp: numeric(audits['first-contentful-paint']),
        ttfb: numeric(audits['server-response-time']),
        topOpportunities,
      };
    } catch (err) {
      this.logger.warn(
        `PageSpeed ${strategy} failed for ${url}: ${(err as Error).message}`,
      );
      return undefined;
    }
  }
}

function pct(score: number | null | undefined): number | undefined {
  if (score === null || score === undefined) return undefined;
  return Math.round(score * 100);
}

function numeric(audit: LighthouseAudit | undefined): number | undefined {
  if (!audit) return undefined;
  return audit.numericValue ? Math.round(audit.numericValue) : undefined;
}

function numericExact(audit: LighthouseAudit | undefined): number | undefined {
  if (!audit) return undefined;
  return audit.numericValue !== undefined
    ? Math.round(audit.numericValue * 1000) / 1000
    : undefined;
}

type LighthouseAudit = {
  id: string;
  title: string;
  numericValue?: number;
  details?: { type?: string };
};

type PageSpeedApiResponse = {
  lighthouseResult?: {
    categories?: Record<string, { score?: number | null } | undefined>;
    audits?: Record<string, LighthouseAudit>;
  };
};
