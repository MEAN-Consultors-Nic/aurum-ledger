import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateContractDto {
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

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsEnum(['active', 'expired', 'cancelled'])
  status?: 'active' | 'expired' | 'cancelled';

  @IsOptional()
  @IsString()
  notes?: string;

  // When true (default), an associated Project is auto-created for active contracts.
  @IsOptional()
  @IsBoolean()
  createProject?: boolean;

  // When true, also create a GitHub repo for the spawned project.
  // Defaults to the GitHub auto-create setting when omitted.
  @IsOptional()
  @IsBoolean()
  createGithubRepo?: boolean;
}
