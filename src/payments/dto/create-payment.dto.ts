import { Transform, Type } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsMongoId, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreatePaymentDto {
  @IsMongoId()
  contractId: string;

  @IsMongoId()
  clientId: string;

  @IsMongoId()
  accountId: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  retentionAmount?: number;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';

  @Transform(({ value }) =>
    value === '' || value === null || value === undefined ? undefined : Number(value),
  )
  @IsOptional()
  @IsNumber()
  @Min(0.0001)
  @Type(() => Number)
  exchangeRate?: number;

  @IsDateString()
  paymentDate: string;

  @IsEnum(['cash', 'bank', 'card', 'transfer', 'other'])
  method: 'cash' | 'bank' | 'card' | 'transfer' | 'other';

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
