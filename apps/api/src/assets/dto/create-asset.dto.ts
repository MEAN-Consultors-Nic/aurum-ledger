import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateAssetDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEnum([
    'real_estate',
    'vehicle',
    'investment',
    'retirement',
    'crypto',
    'cash_equivalent',
    'receivable',
    'other',
  ])
  type:
    | 'real_estate'
    | 'vehicle'
    | 'investment'
    | 'retirement'
    | 'crypto'
    | 'cash_equivalent'
    | 'receivable'
    | 'other';

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsNumber()
  @Type(() => Number)
  currentValue: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
