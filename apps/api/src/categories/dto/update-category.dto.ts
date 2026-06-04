import { IsIn, IsMongoId, IsOptional, IsString } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['income', 'expense', 'transfer'])
  type?: 'income' | 'expense' | 'transfer';

  @IsOptional()
  @IsMongoId()
  parentId?: string;
}
