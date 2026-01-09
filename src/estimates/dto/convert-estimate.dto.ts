import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConvertEstimateDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsEnum(['monthly', 'annual', 'one_time'])
  billingPeriod?: 'monthly' | 'annual' | 'one_time';

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsString()
  contractNotes?: string;

  @IsOptional()
  @IsString()
  conversionNotes?: string;
}
