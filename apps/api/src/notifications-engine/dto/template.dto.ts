import { IsBoolean, IsMongoId, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateTemplateDto {
  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsString()
  @MinLength(1)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  eventKey?: string;

  @IsString()
  @MinLength(1)
  subject: string;

  @IsString()
  @MinLength(1)
  bodyHtml: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsMongoId()
  groupId?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  eventKey?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsOptional()
  @IsString()
  bodyHtml?: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestSendDto {
  @IsString()
  to: string;

  @IsOptional()
  @IsString()
  contextRef?: string;
}

export class PreviewTemplateDto {
  @IsString()
  subject: string;

  @IsString()
  bodyHtml: string;

  @IsOptional()
  @IsString()
  bodyText?: string;

  @IsOptional()
  @IsString()
  eventKey?: string;
}
