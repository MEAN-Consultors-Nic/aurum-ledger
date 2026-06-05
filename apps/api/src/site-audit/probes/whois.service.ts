import { Injectable, Logger } from '@nestjs/common';

/**
 * RDAP (RFC 7483) is the modern WHOIS replacement and is exposed publicly
 * via rdap.org as an aggregator across registries. No key required.
 */
@Injectable()
export class WhoisService {
  private readonly logger = new Logger(WhoisService.name);

  async lookup(hostname: string) {
    const domain = this.toApexDomain(hostname);
    if (!domain) return undefined;

    try {
      const res = await fetch(`https://rdap.org/domain/${domain}`, {
        headers: { Accept: 'application/rdap+json' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        this.logger.warn(`RDAP ${res.status} for ${domain}`);
        return undefined;
      }
      const data = (await res.json()) as RdapResponse;

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
    } catch (err) {
      this.logger.warn(`RDAP failed for ${domain}: ${(err as Error).message}`);
      return undefined;
    }
  }

  /**
   * "blog.example.com" → "example.com". Only handles the common case of
   * one-label TLDs; multi-label TLDs (.com.ni, .co.uk) need the PSL — for
   * an audit a wrong-by-one-label query just fails gracefully.
   */
  private toApexDomain(hostname: string): string | null {
    const parts = hostname.replace(/^www\./, '').split('.');
    if (parts.length < 2) return null;
    // Heuristic: if the last two parts are 2 chars each (ccSLD pattern), keep 3.
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
