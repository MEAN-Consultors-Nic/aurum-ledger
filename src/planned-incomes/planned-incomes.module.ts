import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { PlannedIncomesController } from './planned-incomes.controller';
import { PlannedIncomesService } from './planned-incomes.service';
import { PlannedIncome, PlannedIncomeSchema } from './schemas/planned-income.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceSchema,
} from './schemas/planned-income-occurrence.schema';

@Module({
  imports: [
    AccountsModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: PlannedIncome.name, schema: PlannedIncomeSchema },
      { name: PlannedIncomeOccurrence.name, schema: PlannedIncomeOccurrenceSchema },
    ]),
  ],
  controllers: [PlannedIncomesController],
  providers: [PlannedIncomesService],
  exports: [PlannedIncomesService],
})
export class PlannedIncomesModule {}
