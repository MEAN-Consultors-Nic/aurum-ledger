import {
  MAX_PIN_ATTEMPTS,
  canShareStatus,
  canViewContent,
  clientIp,
  generatePin,
  hashPin,
  isPinFormat,
  linkExpiresAt,
  shareLinkState,
  verifyPin,
} from './share-link';

describe('estimate share link (PIN)', () => {
  it('PINs are 6 digits, leading zeros kept, and vary', () => {
    const pins = new Set(Array.from({ length: 200 }, () => generatePin()));
    for (const p of pins) expect(p).toMatch(/^\d{6}$/);
    expect(pins.size).toBeGreaterThan(190);
  });

  it('stores only a salted hash that verifies the right PIN only', () => {
    const h = hashPin('012345');
    expect(h).not.toContain('012345');
    expect(h).toMatch(/^scrypt\$/);
    expect(hashPin('012345')).not.toBe(h); // salted
    expect(verifyPin('012345', h)).toBe(true);
    expect(verifyPin('012346', h)).toBe(false);
    expect(verifyPin('12345', h)).toBe(false);
    expect(verifyPin('012345', undefined)).toBe(false);
    expect(verifyPin('012345', 'garbage')).toBe(false);
  });

  it('PIN format', () => {
    expect(isPinFormat('000000')).toBe(true);
    expect(isPinFormat('12345')).toBe(false);
    expect(isPinFormat('1234567')).toBe(false);
    expect(isPinFormat('12a456')).toBe(false);
    expect(isPinFormat(123456)).toBe(false);
  });

  it('5 attempts', () => expect(MAX_PIN_ATTEMPTS).toBe(5));

  describe('valid until = end of that day in Nicaragua (UTC-6)', () => {
    const validUntil = new Date('2026-11-20T00:00:00.000Z'); // editor stores YYYY-MM-DD as UTC midnight
    it('expires at 2026-11-21 06:00 UTC (= Nov 20, 23:59:59 in Managua)', () => {
      expect(linkExpiresAt(validUntil)!.toISOString()).toBe(
        '2026-11-21T06:00:00.000Z',
      );
    });
    const facts = { status: 'sent', validUntil };
    it('open late on the last day, expired right after midnight Managua', () => {
      expect(shareLinkState(facts, new Date('2026-11-21T05:59:00Z'))).toBe(
        'open',
      );
      expect(shareLinkState(facts, new Date('2026-11-21T06:00:00Z'))).toBe(
        'expired',
      );
    });
    it('no valid-until never expires', () => {
      expect(linkExpiresAt(undefined)).toBeNull();
      expect(shareLinkState({ status: 'sent' }, new Date('2099-01-01'))).toBe(
        'open',
      );
    });
  });

  describe('link state', () => {
    const now = new Date('2026-11-06T12:00:00Z');
    it('revoked and locked win over everything', () => {
      expect(
        shareLinkState(
          { status: 'sent', shareRevokedAt: now, clientDecision: 'accepted' },
          now,
        ),
      ).toBe('revoked');
      expect(shareLinkState({ status: 'sent', shareLockedAt: now }, now)).toBe(
        'locked',
      );
    });
    it('answered links stay readable even after valid-until', () => {
      const s = shareLinkState(
        {
          status: 'accepted',
          clientDecision: 'accepted',
          validUntil: new Date('2026-01-01'),
        },
        now,
      );
      expect(s).toBe('responded');
      expect(canViewContent(s)).toBe(true);
    });
    it('estimate moved on in Helm: readable, no answer', () => {
      expect(shareLinkState({ status: 'converted' }, now)).toBe('closed');
      expect(shareLinkState({ status: 'rejected' }, now)).toBe('closed');
    });
    it('only open links can be answered; revoked/locked/expired show nothing', () => {
      expect(canViewContent('revoked')).toBe(false);
      expect(canViewContent('locked')).toBe(false);
      expect(canViewContent('expired')).toBe(false);
      expect(shareLinkState({ status: 'draft' }, now)).toBe('open');
    });
  });

  it('links can be created for draft and sent only', () => {
    expect(['draft', 'sent'].every(canShareStatus)).toBe(true);
    expect(
      ['accepted', 'rejected', 'expired', 'converted'].some(canShareStatus),
    ).toBe(false);
  });

  it('client IP = the one the Heroku router appended (last), not a forged first entry', () => {
    expect(clientIp('6.6.6.6, 190.143.1.2')).toBe('190.143.1.2');
    expect(clientIp(undefined, '::1')).toBe('::1');
    expect(clientIp(['1.1.1.1', '2.2.2.2'])).toBe('2.2.2.2');
  });
});
