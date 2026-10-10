import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class LoanProjectionQueryDto {
  /**
   * Hypothetical payment per period. For an open-payment loan the future is
   * not knowable, so the schedule returned beyond today is a simulation.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  paymentPerPeriod?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  maxPeriods?: number;
}
