import { Injectable, Logger } from '@nestjs/common';

type VcardEntry = [string, Record<string, unknown>, string, unknown];
type RdapEntity = {
  roles?: string[];
  handle?: string;
  vcardArray?: [string, VcardEntry[]];
};
type RdapResponse = {
  events?: { eventAction: string; eventDate: string }[];
  entities?: RdapEntity[];
};

/**
 * RDAP lookup. `rdap.org` is a public bouncer that redirects to TLD-specific
 * RDAP servers — it works for everything but is slow because of the hop.
 * For the common TLDs we hit the authoritative server directly first and
 * only fall back to the bouncer on miss.
 */
@Injectable()
export class WhoisService {
  private readonly logger = new Logger(WhoisService.name);

  private readonly direct: Record<string, (d: string) => string> = {
    com: (d) => `https://rdap.verisign.com/com/v1/domain/${d}`,
    net: (d) => `https://rdap.verisign.com/net/v1/domain/${d}`,
    name: (d) => `https://rdap.verisign.com/name/v1/domain/${d}`,
    cc: (d) => `https://rdap.verisign.com/cc/v1/domain/${d}`,
    tv: (d) => `https://rdap.verisign.com/tv/v1/domain/${d}`,
    org: (d) => `https://rdap.publicinterestregistry.org/rdap/domain/${d}`,
  };

  async lookup(hostname: string) {
    const domain = this.toApexDomain(hostname);
    if (!domain) return undefined;

    const tld = domain.split('.').pop()?.toLowerCase() ?? '';
    const direct = this.direct[tld]?.(domain);
    const candidates = [
      direct,
      `https://rdap.org/domain/${domain}`,
    ].filter((u): u is string => !!u);

    for (const url of candidates) {
      const data = await this.queryOnce(url);
      if (data) return this.shape(data);
    }
    return undefined;
  }

  private async queryOnce(url: string): Promise<RdapResponse | null> {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/rdap+json' },
        signal: AbortSignal.timeout(8000),
        redirect: 'follow',
      });
      if (!res.ok) {
        this.logger.warn(`RDAP ${res.status} from ${url}`);
        return null;
      }
      return (await res.json()) as RdapResponse;
    } catch (err) {
      this.logger.warn(`RDAP ${url} failed: ${(err as Error).message}`);
      return null;
    }
  }

  private shape(data: RdapResponse) {
    const events = data.events ?? [];
    const registration = events.find((e) => e.eventAction === 'registration');
    const expiration = events.find((e) => e.eventAction === 'expiration');
    const registrarEntity = (data.entities ?? []).find((e) =>
      e.roles?.includes('registrar'),
    );
    const registrar = this.entityName(registrarEntity);
    const registered = registration?.eventDate;
    const ageYears = registered
      ? Math.floor((Date.now() - new Date(registered).getTime()) / 31557600000)
      : undefined;

    return {
      registered,
      ageYears,
      registrar,
      expiresAt: expiration?.eventDate,
    };
  }

  /**
   * "blog.example.com" → "example.com". Only handles the common case of
   * one-label TLDs; multi-label TLDs (.com.ni, .co.uk) need the PSL — for
   * an audit a wrong-by-one-label query just fails gracefully.
   */
  private toApexDomain(hostname: string): string | null {
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length < 2) return null;
    const last = parts[parts.length - 1];
    const second = parts[parts.length - 2];
    if (last.length === 2 && second.length <= 3 && parts.length >= 3) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  }

  private entityName(entity?: RdapEntity): string | undefined {
    if (!entity) return undefined;
    const vcard = entity.vcardArray?.[1] as VcardEntry[] | undefined;
    const fn = vcard?.find((e) => e[0] === 'fn');
    if (fn && typeof fn[3] === 'string') return fn[3];
    return entity.handle;
  }
}
