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
  Matches,
  MaxLength,
  Min,
  MinLength,
  Max,
} from 'class-validator';
import { LINE_KINDS, LineKind } from '../schemas/fortnight-plan.schema';
import { PERIOD_KEY_PATTERN } from '../fortnight-period';

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Empty strings from HTML selects mean "not set". */
const emptyToUndefined = ({ value }: { value: unknown }) =>
  value === '' || value === null ? undefined : value;

export class OpenPlanDto {
  /** "YYYY-MM-1" (1st–15th) or "YYYY-MM-2" (16th–end of month). */
  @IsString()
  @Matches(PERIOD_KEY_PATTERN, {
    message: 'periodKey must look like 2026-11-1 or 2026-11-2',
  })
  periodKey: string;
}

export class UpdatePlanDto {
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  notes?: string;
}

export class ClosePlanDto {
  /** What happens to lines still planned: move them to the next fortnight, or drop them. */
  @IsOptional()
  @IsIn(['carry', 'skip'])
  pending?: 'carry' | 'skip';
}

export class CreateLineDto {
  @IsIn(LINE_KINDS)
  kind: LineKind;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsNumber()
  @Min(0)
  @Type(() => Number)
  plannedAmount: number;

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  accountId?: string;

  /** savings only. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  toAccountId?: string;

  /** YYYY-MM-DD */
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY_PATTERN, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /** Copy this line into the next fortnight automatically. */
  @IsOptional()
  @IsBoolean()
  repeat?: boolean;
}

export class UpdateLineDto {
  @IsOptional()
  @IsIn(LINE_KINDS)
  kind?: LineKind;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  plannedAmount?: number;

  @IsOptional()
  @IsIn(['USD', 'NIO'])
  currency?: 'USD' | 'NIO';

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  accountId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  toAccountId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY_PATTERN, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsBoolean()
  repeat?: boolean;
}

export class ApplyLineDto {
  /** What was actually paid / received, in the line's currency. Defaults to the planned amount. */
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount?: number;

  /** YYYY-MM-DD. Defaults to today. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  /** manual lines: account to use when the line has none, or to override it. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  accountId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  categoryId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsMongoId()
  toAccountId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  /**
   * manual lines: when less than planned was paid, keep the difference as a
   * new planned line instead of closing the obligation.
   */
  @IsOptional()
  @IsBoolean()
  keepRemainder?: boolean;
}

export class RecordUnplannedDto {
  @IsOptional()
  @IsIn(['expense', 'income'])
  kind?: 'expense' | 'income';

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsNumber()
  @Min(0.01)
  @Type(() => Number)
  amount: number;

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsMongoId()
  accountId: string;

  @IsMongoId()
  categoryId: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @Matches(DAY_PATTERN, { message: 'date must be YYYY-MM-DD' })
  date?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class PromoteLineDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value) ? value.map((item) => Number(item)) : value,
  )
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(31, { each: true })
  daysOfMonth: number[];
}

export class AnalyticsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(48)
  limit?: number;
}
