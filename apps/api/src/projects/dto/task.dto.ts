import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
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
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

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
  startDate?: string;

  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @IsMongoId()
  assignedTo?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  order?: number;
}

export class MoveTaskDto {
  @IsEnum(['todo', 'in_progress', 'blocked', 'done'])
  status: 'todo' | 'in_progress' | 'blocked' | 'done';

  @IsInt()
  @Min(0)
  @Type(() => Number)
  order: number;
}

export class ChecklistItemDto {
  @IsString()
  @IsNotEmpty()
  text: string;
}

export class UpdateChecklistItemDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  done?: boolean;
}
