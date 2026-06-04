import { PartialType } from '@nestjs/swagger';
import { CreatePlannedIncomeDto } from './create-planned-income.dto';

export class UpdatePlannedIncomeDto extends PartialType(CreatePlannedIncomeDto) {}
