import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Min,
} from 'class-validator';

export class PresignAttachmentDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  mimeType: string;

  @IsInt()
  @Min(1)
  @Type(() => Number)
  sizeBytes: number;

  @IsEnum(['estimate', 'contract', 'project', 'task', 'client'])
  parentType: 'estimate' | 'contract' | 'project' | 'task' | 'client';

  @IsMongoId()
  parentId: string;
}
