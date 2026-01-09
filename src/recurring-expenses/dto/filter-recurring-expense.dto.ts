import { IsBooleanString, IsOptional } from 'class-validator';

export class FilterRecurringExpenseDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
