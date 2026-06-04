import { Type } from 'class-transformer';
import { IsIn, IsMongoId, IsNumber, Max, Min } from 'class-validator';

export class CreateBudgetDto {
  @IsMongoId()
  categoryId: string;

  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month: number;

  @IsNumber()
  @Min(2000)
  @Type(() => Number)
  year: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';
}
