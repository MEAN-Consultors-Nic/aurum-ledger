import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateDeliverableDto {
  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateDeliverableDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsOptional()
  @IsBoolean()
  done?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}
