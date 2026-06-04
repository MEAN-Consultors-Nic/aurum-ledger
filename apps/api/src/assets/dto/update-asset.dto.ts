import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateAssetDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
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
  type?:
    | 'real_estate'
    | 'vehicle'
    | 'investment'
    | 'retirement'
    | 'crypto'
    | 'cash_equivalent'
    | 'receivable'
    | 'other';

  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  currentValue?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
