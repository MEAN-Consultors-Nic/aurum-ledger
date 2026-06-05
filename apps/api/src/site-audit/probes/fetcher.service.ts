import { Injectable, Logger } from '@nestjs/common';

export type FetchResult = {
  ok: boolean;
  status?: number;
  finalUrl?: string;
  responseMs: number;
  contentType?: string;
  contentLength?: number;
  body: string;
  headers: Record<string, string>;
  error?: string;
};

const USER_AGENT =
  'Mozilla/5.0 (compatible; Helm-Audit/1.0; +https://meanconsultors.com)';

@Injectable()
export class FetcherService {
  private readonly logger = new Logger(FetcherService.name);

  async fetch(url: string, timeoutMs = 15000): Promise<FetchResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          'User-Agent': USER_AGENT,
          // Some bot-shielded sites 403 us without a believable Accept.
          Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,es;q=0.8',
        },
      });
      const responseMs = Date.now() - started;
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      const body = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        finalUrl: res.url,
        responseMs,
        contentType: headers['content-type'],
        contentLength: body.length,
        body,
        headers,
      };
    } catch (err) {
      const responseMs = Date.now() - started;
      return {
        ok: false,
        responseMs,
        body: '',
        headers: {},
        error: (err as Error).message ?? 'fetch failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }
}
