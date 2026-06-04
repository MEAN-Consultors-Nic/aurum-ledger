import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateGithubSettingsDto {
  @IsOptional()
  @IsString()
  org?: string;

  /**
   * Set a value to update the encrypted token; pass an empty string or
   * null to clear it. Omit the field entirely to keep the current token.
   */
  @IsOptional()
  token?: string | null;

  @IsOptional()
  @IsBoolean()
  autoCreate?: boolean;

  @IsOptional()
  @IsBoolean()
  defaultPrivate?: boolean;
}
