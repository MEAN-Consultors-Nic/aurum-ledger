import { IsEnum, IsMongoId, IsOptional, IsString } from 'class-validator';

export class FilterEstimateDto {
  @IsOptional()
  @IsMongoId()
  clientId?: string;

  @IsOptional()
  @IsEnum(['draft', 'sent', 'accepted', 'rejected', 'expired', 'converted'])
  status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
