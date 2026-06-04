import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateEstimateDto {
  @IsMongoId()
  clientId: string;

  @IsMongoId()
  serviceId: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsEnum(['monthly', 'annual', 'one_time'])
  billingPeriod: 'monthly' | 'annual' | 'one_time';

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';

  @IsOptional()
  @IsEnum(['draft', 'sent', 'accepted', 'rejected', 'expired'])
  status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';

  @IsOptional()
  @IsString()
  notes?: string;
}
