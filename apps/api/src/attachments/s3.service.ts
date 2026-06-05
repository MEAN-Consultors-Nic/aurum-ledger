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

  /** Builds a fresh S3 client per call. Settings can change at runtime
   *  (admin edits in the portal) so we re-read every time. */
  private async client(): Promise<{ s3: S3Client; bucket: string; region: string }> {
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
      forcePathStyle: !!cfg.endpoint,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: secret,
      },
    });
    return { s3, bucket: cfg.bucket, region: cfg.region };
  }

  /**
   * Server-side upload — the API holds the file in memory and PUTs it to S3
   * with credentials. No presigned URLs, no checksum dance, no CORS headaches.
   * The browser never talks to S3 directly.
   */
  async uploadObject(
    key: string,
    body: Buffer,
    contentType: string,
  ): Promise<{ bucket: string; key: string }> {
    if (!body || body.length === 0) {
      throw new BadRequestException('Upload body is empty');
    }
    const { s3, bucket } = await this.client();
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
    this.logger.log(`uploaded ${key} (${body.length} bytes) to ${bucket}`);
    return { bucket, key };
  }

  /** Presigned GET URL — short-lived, used for downloads. */
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
      // Best-effort: don't fail the soft-delete on S3 errors.
      this.logger.warn(`S3 delete failed for ${key}: ${(err as Error).message}`);
    }
  }

  async bucketName(): Promise<string> {
    const cfg = await this.settingsService.getS3Settings();
    return cfg.bucket;
  }
}
