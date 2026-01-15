import { IsNumber, IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class ResetAccountDto {
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentBalance: number;

  @IsOptional()
  @IsString()
  note?: string;
}
