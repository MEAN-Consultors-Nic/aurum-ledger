import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateTaskDto {
  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'blocked', 'done'])
  status?: 'todo' | 'in_progress' | 'blocked' | 'done';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;
}

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(['todo', 'in_progress', 'blocked', 'done'])
  status?: 'todo' | 'in_progress' | 'blocked' | 'done';

  @IsOptional()
  @IsEnum(['low', 'medium', 'high'])
  priority?: 'low' | 'medium' | 'high';

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;
}
