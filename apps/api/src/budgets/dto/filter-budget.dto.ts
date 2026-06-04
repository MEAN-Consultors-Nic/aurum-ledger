import { IsOptional, IsString } from 'class-validator';

export class FilterBudgetDto {
  @IsOptional()
  @IsString()
  month?: string;

  @IsOptional()
  @IsString()
  year?: string;
}
