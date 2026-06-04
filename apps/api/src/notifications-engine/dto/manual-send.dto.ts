import { IsArray, IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

export class ManualSendDto {
  @IsMongoId()
  templateId: string;

  @IsIn(['contract', 'project', 'client'])
  contextType: 'contract' | 'project' | 'client';

  @IsString()
  contextId: string;

  // Recipient expressions OR direct emails (same shape as rules).
  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @IsOptional()
  @IsString()
  note?: string;
}
