import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import { LOAN_KINDS, LOAN_SCHEDULE_TYPES, LoanKind, LoanScheduleType } from '../schemas/loan.schema';

export class CreateLoanDto {
  @IsString()
  name: string;

  @IsIn(LOAN_KINDS as unknown as string[])
  kind: LoanKind;

  /** Capital borrowed, or the total of a commercial credit. */
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  principal: number;

  @IsIn(['USD', 'NIO'])
  currency: 'USD' | 'NIO';

  @IsMongoId()
  accountId: string;

  @IsMongoId()
  categoryId: string;

  @IsIn(LOAN_SCHEDULE_TYPES as unknown as string[])
  scheduleType: LoanScheduleType;

  @ValidateIf((dto: CreateLoanDto) => dto.scheduleType === 'monthly_days')
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(4)
  @Transform(({ value }) => (Array.isArray(value) ? value.map((item) => Number(item)) : value))
  @IsNumber({}, { each: true })
  @Min(1, { each: true })
  @Max(31, { each: true })
  daysOfMonth?: number[];

  /** 7 = weekly, 14 = fortnightly. */
  @ValidateIf((dto: CreateLoanDto) => dto.scheduleType === 'interval_days')
  @IsNumber({}, { message: 'An interval schedule needs intervalDays: 7 for weekly, 14 for fortnightly' })
  @Min(1, { message: 'intervalDays must be at least 1' })
  @Max(365, { message: 'intervalDays cannot exceed 365' })
  @Type(() => Number)
  intervalDays?: number;

  /** Required for interval_days: the first payment date anchors the series. */
  @ValidateIf((dto: CreateLoanDto) => dto.scheduleType === 'interval_days')
  @IsDateString({}, { message: 'An interval schedule needs startDate: the date of the first payment' })
  startDate?: string;

  /** fixed_installment: the amount due every period. */
  @ValidateIf((dto: CreateLoanDto) => dto.kind === 'fixed_installment')
  @IsNumber({}, { message: 'A fixed-instalment debt needs installmentAmount: the amount due each period' })
  @Min(0, { message: 'installmentAmount cannot be negative' })
  @Type(() => Number)
  installmentAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  totalInstallments?: number;

  /** interest_bearing: rate per period on the outstanding balance, in percent. */
  @ValidateIf((dto: CreateLoanDto) => dto.kind === 'interest_bearing')
  @IsNumber({}, { message: 'An interest-bearing loan needs interestRatePercent: the rate charged per period, e.g. 4 for 4%' })
  @Min(0, { message: 'interestRatePercent cannot be negative' })
  @Max(100, { message: 'interestRatePercent cannot exceed 100 per period' })
  @Type(() => Number)
  interestRatePercent?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  notes?: string;
}
