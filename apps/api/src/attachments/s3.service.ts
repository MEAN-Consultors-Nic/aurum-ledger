import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class S3Service {
  private readonly logger = new Logger(S3Service.name);

  constructor(private readonly settingsService: SettingsService) {}

  async isConfigured(): Promise<boolean> {
    const cfg = await this.settingsService.getS3Settings();
    const secret = await this.settingsService.getS3SecretAccessKey();
    return !!(cfg.bucket && cfg.region && cfg.accessKeyId && secret);
  }

  private async client(): Promise<{ s3: S3Client; bucket: string }> {
    const cfg = await this.settingsService.getS3Settings();
    const secret = await this.settingsService.getS3SecretAccessKey();
    if (!cfg.bucket || !cfg.region || !cfg.accessKeyId || !secret) {
      throw new BadRequestException(
        'S3 is not configured. Add bucket / region / access key / secret in Settings → S3.',
      );
    }
    const s3 = new S3Client({
      region: cfg.region,
      endpoint: cfg.endpoint || undefined,
      forcePathStyle: !!cfg.endpoint, // R2/B2/MinIO require path-style
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: secret,
      },
      // AWS SDK v3.729+ adds an x-amz-checksum-crc32 to presigned PUTs by
      // default; the browser uploads the raw file without computing that
      // checksum client-side, so S3 returns 400 on mismatch. Opt out of
      // the automatic checksum so presigned uploads work from the browser.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
    return { s3, bucket: cfg.bucket };
  }

  /** Presigned URL the browser will PUT the file bytes to (15-minute TTL). */
  async presignUpload(key: string, contentType: string): Promise<string> {
    const { s3, bucket } = await this.client();
    return getSignedUrl(
      s3,
      new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
      { expiresIn: 60 * 15 },
    );
  }

  /** Presigned GET URL (10-minute TTL) used for downloads. */
  async presignDownload(key: string, filename?: string): Promise<string> {
    const { s3, bucket } = await this.client();
    return getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: bucket,
        Key: key,
        ResponseContentDisposition: filename
          ? `attachment; filename="${filename.replace(/"/g, '')}"`
          : undefined,
      }),
      { expiresIn: 60 * 10 },
    );
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const { s3, bucket } = await this.client();
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    } catch (err) {
      // Don't fail soft-delete just because the bucket call failed.
      this.logger.warn(`S3 delete failed for ${key}: ${(err as Error).message}`);
    }
  }

  /** Returns the configured bucket name (for pinning to attachment records). */
  async bucketName(): Promise<string> {
    const cfg = await this.settingsService.getS3Settings();
    return cfg.bucket;
  }
}
