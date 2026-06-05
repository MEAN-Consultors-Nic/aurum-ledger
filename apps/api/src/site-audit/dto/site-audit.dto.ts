import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';

export class CreateSiteAuditDto {
  @IsString()
  @IsUrl({ require_protocol: false })
  url: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  partnerName?: string;

  @IsOptional()
  @IsString()
  clientId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  clientName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;
}

export class ConvertToEstimateDto {
  /** Indexes into ai.suggestedLineItems that the user wants to include. */
  itemIndexes?: number[];

  clientId?: string;

  notes?: string;

  hourlyRate?: number;
}
