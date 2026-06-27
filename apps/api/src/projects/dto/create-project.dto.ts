import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsMongoId()
  contractId?: string;

  @IsMongoId()
  clientId: string;

  @IsOptional()
  @IsMongoId()
  serviceId?: string;

  @IsOptional()
  @IsEnum(['active', 'on_hold', 'completed', 'archived'])
  status?: 'active' | 'on_hold' | 'completed' | 'archived';

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  progress?: number;

  @IsOptional()
  @IsString()
  templateKey?: string;
}
