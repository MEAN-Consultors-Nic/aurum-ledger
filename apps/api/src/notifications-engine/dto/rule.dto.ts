import { IsArray, IsBoolean, IsMongoId, IsObject, IsOptional, IsString } from 'class-validator';

export class CreateRuleDto {
  @IsString()
  name: string;

  @IsString()
  eventKey: string;

  @IsMongoId()
  templateId: string;

  @IsArray()
  @IsString({ each: true })
  recipients: string[];

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateRuleDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  eventKey?: string;

  @IsOptional()
  @IsMongoId()
  templateId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recipients?: string[];

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
