import { IsOptional, IsString } from 'class-validator';

export class FilterAccountDto {
  @IsOptional()
  @IsString()
  isActive?: string;

  @IsOptional()
  @IsString()
  includeBalance?: string;
}
