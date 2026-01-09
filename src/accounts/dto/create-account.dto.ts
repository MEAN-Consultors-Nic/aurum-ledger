import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsIn, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAccountDto {
  @IsString()
  name: string;

  @IsIn(['bank', 'paypal', 'cash', 'other'])
  type: 'bank' | 'paypal' | 'cash' | 'other';

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  initialBalance?: number;

  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
