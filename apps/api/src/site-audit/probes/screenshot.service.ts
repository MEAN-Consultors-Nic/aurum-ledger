import { Injectable, Logger } from '@nestjs/common';

/**
 * Microlink.io has a generous free tier (50/day, no key) and returns a
 * CDN URL we can hand directly to GPT-vision and to the report card.
 */
@Injectable()
export class ScreenshotService {
  private readonly logger = new Logger(ScreenshotService.name);

  async capture(url: string): Promise<string | undefined> {
    const params = new URLSearchParams({
      url,
      screenshot: 'true',
      meta: 'false',
      audio: 'false',
      video: 'false',
      embed: 'screenshot.url',
      waitForTimeout: '2500',
      'viewport.width': '1280',
      'viewport.height': '800',
    });
    try {
      const res = await fetch(`https://api.microlink.io/?${params.toString()}`, {
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        this.logger.warn(`Microlink ${res.status} for ${url}`);
        return undefined;
      }
      // When embed=screenshot.url is set, Microlink returns the raw URL as
      // a redirect; otherwise we parse the JSON envelope.
      const ct = res.headers.get('content-type') ?? '';
      if (ct.includes('application/json')) {
        const data = (await res.json()) as {
          data?: { screenshot?: { url?: string } };
        };
        return data.data?.screenshot?.url;
      }
      // Followed redirect — the final URL is the screenshot itself.
      return res.url;
    } catch (err) {
      this.logger.warn(`Screenshot failed for ${url}: ${(err as Error).message}`);
      return undefined;
    }
  }
}
