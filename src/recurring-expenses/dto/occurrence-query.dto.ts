import { IsOptional, IsString, Matches } from 'class-validator';

export class RecurringOccurrenceQueryDto {
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}$/)
  month?: string;
}
