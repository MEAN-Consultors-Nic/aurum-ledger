import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class UpdateSiteMonitorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  url?: string;

  @IsOptional()
  @IsMongoId()
  projectId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsDateString()
  domainExpiresAt?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  sslWarnDays?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Type(() => Number)
  domainWarnDays?: number;
}
