import { randomBytes, randomInt, scryptSync, timingSafeEqual } from 'crypto';

/**
 * PIN-protected estimate links ("Share by link").
 *
 * Each link has a 6-digit PIN that Helm generates, shows once to the user
 * and stores only as a salted scrypt hash. The client needs the PIN to open
 * the proposal and again to accept or decline it.
 *
 * A 6-digit PIN can be brute-forced offline from its hash, so the hash is
 * never returned by any endpoint (`select: false` in the schema). Online
 * guessing is bounded by MAX_PIN_ATTEMPTS per link; the link token itself is
 * 256-bit random, so links cannot be enumerated.
 */

export const PIN_LENGTH = 6;
export const MAX_PIN_ATTEMPTS = 5;

/**
 * The business runs in Nicaragua (UTC-6, no daylight saving). A "valid
 * until" date counts through the end of that day there.
 */
const BUSINESS_UTC_OFFSET_HOURS = -6;

export function generatePin(): string {
  return String(randomInt(0, 10 ** PIN_LENGTH)).padStart(PIN_LENGTH, '0');
}

export function isPinFormat(pin: unknown): pin is string {
  return typeof pin === 'string' && /^\d{6}$/.test(pin);
}

export function hashPin(pin: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pin, salt, 32);
  return `scrypt$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPin(
  pin: string,
  stored: string | undefined | null,
): boolean {
  if (!stored || !isPinFormat(pin)) return false;
  const [scheme, saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = scryptSync(
    pin,
    Buffer.from(saltB64, 'base64'),
    expected.length,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/**
 * When a link stops working because of "valid until": the end of that
 * calendar day in Nicaragua. `validUntil` is stored as UTC midnight of the
 * chosen date (the editor sends YYYY-MM-DD).
 */
export function linkExpiresAt(validUntil?: Date | null): Date | null {
  if (!validUntil) return null;
  const d = new Date(validUntil);
  if (Number.isNaN(d.getTime())) return null;
  const startUtc = Date.UTC(
    d.getUTCFullYear(),
    d.getUTCMonth(),
    d.getUTCDate(),
  );
  return new Date(startUtc + (24 - BUSINESS_UTC_OFFSET_HOURS) * 3600 * 1000);
}

export type ClientDecision = 'accepted' | 'declined';

export type ShareLinkFacts = {
  status: string;
  validUntil?: Date | null;
  shareRevokedAt?: Date | null;
  shareLockedAt?: Date | null;
  clientDecision?: ClientDecision | null;
};

/**
 * What the public link may do right now.
 * - revoked / locked: nothing (the user must create a new link).
 * - responded: the client already accepted or declined: read-only.
 * - expired: past "valid until" without an answer: nothing.
 * - closed: Helm moved the estimate on (converted, rejected, expired by
 *   hand): read-only, no answer possible.
 * - open: the client can read and answer.
 */
export type ShareLinkState =
  | 'revoked'
  | 'locked'
  | 'responded'
  | 'expired'
  | 'closed'
  | 'open';

export function shareLinkState(
  f: ShareLinkFacts,
  now = new Date(),
): ShareLinkState {
  if (f.shareRevokedAt) return 'revoked';
  if (f.shareLockedAt) return 'locked';
  if (f.clientDecision) return 'responded';
  const expiresAt = linkExpiresAt(f.validUntil);
  if (expiresAt && now.getTime() >= expiresAt.getTime()) return 'expired';
  if (f.status !== 'draft' && f.status !== 'sent') return 'closed';
  return 'open';
}

/** Content is shown (after the PIN) only when the link is open or read-only. */
export function canViewContent(state: ShareLinkState): boolean {
  return state === 'open' || state === 'responded' || state === 'closed';
}

/** Estimates a new link can be created for. */
export function canShareStatus(status: string): boolean {
  return status === 'draft' || status === 'sent';
}

/**
 * The client's IP behind the Heroku router: the router appends the address
 * it saw as the LAST X-Forwarded-For entry; earlier entries come from the
 * client and can be forged.
 */
export function clientIp(
  forwardedFor: string | string[] | undefined,
  socketIp?: string,
): string {
  const raw = Array.isArray(forwardedFor)
    ? forwardedFor.join(',')
    : (forwardedFor ?? '');
  const parts = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return (parts[parts.length - 1] ?? socketIp ?? '').slice(0, 64);
}
