import { Type } from 'class-transformer';
import { IsIn, IsMongoId, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateBudgetDto {
  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(12)
  @Type(() => Number)
  month?: number;

  @IsOptional()
  @IsNumber()
  @Min(2000)
  @Type(() => Number)
  year?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount?: number;

  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';
}
