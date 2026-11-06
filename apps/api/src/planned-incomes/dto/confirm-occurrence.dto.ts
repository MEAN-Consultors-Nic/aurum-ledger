import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmOccurrenceDto {
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  receivedAmount?: number;

  /** When the money actually arrived. Defaults to the planned date. */
  @IsOptional()
  @IsDateString()
  receivedDate?: string;

  @IsOptional()
  @IsString()
  note?: string;
}
