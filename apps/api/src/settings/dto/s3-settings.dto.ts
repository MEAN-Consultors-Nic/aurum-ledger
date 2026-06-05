import { IsOptional, IsString } from 'class-validator';

export class UpdateS3SettingsDto {
  @IsOptional()
  @IsString()
  bucket?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  accessKeyId?: string;

  /** Set to update; pass null/empty to clear. Omit to keep current. */
  @IsOptional()
  secretAccessKey?: string | null;

  /** Override S3 endpoint for R2/B2/MinIO. Empty string for standard AWS. */
  @IsOptional()
  @IsString()
  endpoint?: string;
}
