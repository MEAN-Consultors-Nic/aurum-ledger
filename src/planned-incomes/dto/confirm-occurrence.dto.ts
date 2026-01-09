import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ConfirmOccurrenceDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  receivedAmount?: number;

  @IsOptional()
  @IsString()
  note?: string;
}
