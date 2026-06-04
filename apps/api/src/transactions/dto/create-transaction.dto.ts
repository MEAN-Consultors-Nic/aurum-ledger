import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateTransactionDto {
  @IsIn(['income', 'expense', 'adjustment'])
  type: 'income' | 'expense' | 'adjustment';

  @IsMongoId()
  accountId: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  exchangeRate?: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsMongoId()
  linkedClientId?: string;

  @IsOptional()
  @IsMongoId()
  linkedContractId?: string;

  @IsOptional()
  @IsIn(['in', 'out'])
  flow?: 'in' | 'out';
}
