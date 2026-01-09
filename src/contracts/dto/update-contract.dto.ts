import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateContractDto {
  @IsOptional()
  @IsMongoId()
  clientId?: string;

  @IsOptional()
  @IsMongoId()
  serviceId?: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsEnum(['monthly', 'annual', 'one_time'])
  billingPeriod?: 'monthly' | 'annual' | 'one_time';

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['active', 'expired', 'cancelled'])
  status?: 'active' | 'expired' | 'cancelled';

  @IsOptional()
  @IsString()
  notes?: string;
}
