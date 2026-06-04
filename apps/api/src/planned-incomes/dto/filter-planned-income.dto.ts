import { IsBooleanString, IsOptional } from 'class-validator';

export class FilterPlannedIncomeDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
