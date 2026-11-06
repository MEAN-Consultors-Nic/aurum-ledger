import { Type } from 'class-transformer';
import { IsDateString, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

/**
 * Optional on purpose: an empty body confirms exactly what was scheduled,
 * which is what the screen has always sent.
 */
export class ConfirmRecurringOccurrenceDto {
  /** What was actually paid. Defaults to the scheduled amount. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  /** Defaults to the occurrence date. */
  @IsOptional()
  @IsDateString()
  paidDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}
