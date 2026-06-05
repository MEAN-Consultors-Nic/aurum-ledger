import { Injectable, Logger } from '@nestjs/common';
import { connect, TLSSocket } from 'node:tls';
import { URL } from 'node:url';

export type HttpCheckResult = {
  isUp: boolean;
  status?: number;
  responseMs: number;
  error?: string;
};

export type SslCheckResult = {
  validTo: Date;
  issuer: string;
};

/**
 * Pure-function side: actually talks to the network.
 * Kept separate from the service that owns the schema so checks
 * can be exercised without DB plumbing.
 */
@Injectable()
export class SiteMonitorChecker {
  private readonly logger = new Logger(SiteMonitorChecker.name);

  async http(url: string, timeoutMs = 10000): Promise<HttpCheckResult> {
    const started = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
        headers: {
          // Identify our pings so server logs are obvious.
          'User-Agent': 'Helm-Monitor/1.0',
        },
      });
      const responseMs = Date.now() - started;
      // 2xx and 3xx count as 'up'. 4xx/5xx are down (configuration/server issue).
      const isUp = res.status >= 200 && res.status < 400;
      // Drain the body so the socket can be released.
      try {
        await res.arrayBuffer();
      } catch {
        /* ignore */
      }
      return { isUp, status: res.status, responseMs };
    } catch (err) {
      const responseMs = Date.now() - started;
      return {
        isUp: false,
        responseMs,
        error: (err as Error).message ?? 'request failed',
      };
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Pulls the leaf certificate via a TLS handshake. Works for any HTTPS host;
   * doesn't issue an HTTP request. rejectUnauthorized:false lets us inspect
   * expired or self-signed certs (we just want the dates).
   */
  ssl(url: string, timeoutMs = 10000): Promise<SslCheckResult> {
    return new Promise((resolve, reject) => {
      let parsed: URL;
      try {
        parsed = new URL(url);
      } catch (err) {
        reject(new Error('Invalid URL'));
        return;
      }
      if (parsed.protocol !== 'https:') {
        reject(new Error('SSL check requires an https:// URL'));
        return;
      }
      const host = parsed.hostname;
      const port = parsed.port ? Number(parsed.port) : 443;

      const socket: TLSSocket = connect(
        { host, port, servername: host, rejectUnauthorized: false },
        () => {
          const cert = socket.getPeerCertificate();
          socket.end();
          if (!cert || !cert.valid_to) {
            reject(new Error('Could not read certificate'));
            return;
          }
          resolve({
            validTo: new Date(cert.valid_to),
            issuer:
              (cert.issuer as Record<string, string>)?.CN ??
              (cert.issuer as Record<string, string>)?.O ??
              '',
          });
        },
      );
      socket.setTimeout(timeoutMs, () => {
        socket.destroy();
        reject(new Error('SSL check timeout'));
      });
      socket.on('error', (err) => reject(err));
    });
  }
}
