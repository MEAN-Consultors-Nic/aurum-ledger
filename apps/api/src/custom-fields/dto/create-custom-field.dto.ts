import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateCustomFieldDto {
  @IsEnum(['client', 'project', 'contract', 'estimate', 'task', 'service'])
  entityType:
    | 'client'
    | 'project'
    | 'contract'
    | 'estimate'
    | 'task'
    | 'service';

  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  label: string;

  @IsEnum(['text', 'textarea', 'number', 'date', 'boolean', 'select', 'url'])
  type: 'text' | 'textarea' | 'number' | 'date' | 'boolean' | 'select' | 'url';

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  defaultValue?: unknown;

  @IsOptional()
  @IsString()
  placeholder?: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsOptional()
  @IsInt()
  @Type(() => Number)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
