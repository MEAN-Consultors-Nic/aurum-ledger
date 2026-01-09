import { IsBooleanString, IsOptional } from 'class-validator';

export class FilterSubscriptionDto {
  @IsOptional()
  @IsBooleanString()
  isActive?: string;
}
