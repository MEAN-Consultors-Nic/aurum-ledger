import { IsEnum, IsOptional, IsString } from 'class-validator';

export class UpdateServiceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEnum(['recurring', 'one_time'])
  billingType?: 'recurring' | 'one_time';

  @IsOptional()
  @IsEnum(['monthly', 'annual', 'one_time'])
  defaultPeriod?: 'monthly' | 'annual' | 'one_time';

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  isActive?: boolean;
}
