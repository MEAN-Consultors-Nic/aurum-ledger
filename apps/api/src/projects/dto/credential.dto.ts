import { IsObject, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCredentialDto {
  @IsString()
  @MinLength(1)
  type: string;

  @IsString()
  @MinLength(1)
  name: string;

  // Free-form key-value object. Encrypted server-side.
  @IsObject()
  fields: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateCredentialDto {
  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsObject()
  fields?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  notes?: string;
}
