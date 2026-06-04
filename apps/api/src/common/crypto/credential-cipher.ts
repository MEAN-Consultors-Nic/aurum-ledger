import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

@Injectable()
export class CredentialCipher {
  private readonly logger = new Logger(CredentialCipher.name);
  private readonly key: Buffer | null;

  constructor(config: ConfigService) {
    const raw = config.get<string>('CREDENTIAL_ENCRYPTION_KEY');
    if (!raw) {
      this.logger.warn(
        'CREDENTIAL_ENCRYPTION_KEY is not set — credential reads/writes will be rejected until configured',
      );
      this.key = null;
      return;
    }
    const buf = this.decodeKey(raw);
    if (buf.length !== KEY_LENGTH) {
      this.logger.error(
        `CREDENTIAL_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes; got ${buf.length}`,
      );
      this.key = null;
      return;
    }
    this.key = buf;
  }

  get isReady() {
    return !!this.key;
  }

  encrypt(payload: Record<string, unknown>): string {
    this.assertReady();
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key!, iv);
    const plaintext = Buffer.from(JSON.stringify(payload), 'utf8');
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
  }

  decrypt(blob: string): Record<string, unknown> {
    this.assertReady();
    const raw = Buffer.from(blob, 'base64');
    if (raw.length < IV_LENGTH + 16) {
      throw new Error('Encrypted blob is too short to be valid');
    }
    const iv = raw.subarray(0, IV_LENGTH);
    const tag = raw.subarray(IV_LENGTH, IV_LENGTH + 16);
    const ciphertext = raw.subarray(IV_LENGTH + 16);
    const decipher = createDecipheriv(ALGORITHM, this.key!, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(plaintext.toString('utf8'));
  }

  private assertReady() {
    if (!this.key) {
      throw new ServiceUnavailableException(
        'Credential encryption is not configured (CREDENTIAL_ENCRYPTION_KEY missing).',
      );
    }
  }

  private decodeKey(raw: string): Buffer {
    const trimmed = raw.trim();
    if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_LENGTH * 2) {
      return Buffer.from(trimmed, 'hex');
    }
    return Buffer.from(trimmed, 'base64');
  }
}
