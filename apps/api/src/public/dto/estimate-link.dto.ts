import {
  Equals,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Every public estimate action carries the link's PIN. */
export class EstimatePinDto {
  @IsString()
  @Matches(/^\d{6}$/, { message: 'The PIN has 6 digits.' })
  pin: string;
}

export class AcceptEstimateDto extends EstimatePinDto {
  /** Full name typed by the client as their signature. */
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  @Equals(true, { message: 'Please accept the terms to continue.' })
  acceptTerms: boolean;
}

export class DeclineEstimateDto extends EstimatePinDto {
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
