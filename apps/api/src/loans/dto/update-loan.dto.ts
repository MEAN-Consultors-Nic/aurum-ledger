import { PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';
import { CreateLoanDto } from './create-loan.dto';

export class UpdateLoanDto extends PartialType(CreateLoanDto) {
  /**
   * Corrects what is still owed. Once a debt has confirmed payments this is
   * the only way to change its numbers: the original amount stays as it was
   * recorded, and the balance is what interest and payments work from.
   */
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  currentBalance?: number;
}
