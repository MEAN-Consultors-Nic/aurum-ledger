import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class ConfirmLoanPaymentDto {
  /**
   * What was actually handed over. On an interest-bearing loan the interest
   * for the period is covered first and the rest reduces the capital, so this
   * is the number that drives everything. Defaults to the scheduled amount.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paidAmount?: number;

  /** Defaults to the occurrence date. */
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
