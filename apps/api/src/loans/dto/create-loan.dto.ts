import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateLoanDto {
  @IsString()
  name: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  principal: number;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  installmentAmount: number;

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsMongoId()
  accountId: string;

  @IsMongoId()
  categoryId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => Number(item)) : value))
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(31, { each: true })
  daysOfMonth: number[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
