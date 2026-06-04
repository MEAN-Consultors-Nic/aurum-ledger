import { IsString, MinLength } from 'class-validator';

export class OmitPaymentDto {
  @IsString()
  @MinLength(3)
  note: string;
}
