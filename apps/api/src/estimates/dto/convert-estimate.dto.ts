import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

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

  // When true (default), an associated Project is auto-created from the contract.
  @IsOptional()
  @IsBoolean()
  createProject?: boolean;

  // When true, also create a GitHub repo for the spawned project.
  @IsOptional()
  @IsBoolean()
  createGithubRepo?: boolean;
}
