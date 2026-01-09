import { IsBooleanString, IsOptional } from 'class-validator';

export class FilterLoanDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
