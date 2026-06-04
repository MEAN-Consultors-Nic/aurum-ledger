import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { RecurringExpensesController } from './recurring-expenses.controller';
import { RecurringExpensesService } from './recurring-expenses.service';
import { RecurringExpense, RecurringExpenseSchema } from './schemas/recurring-expense.schema';
import {
  RecurringExpenseOccurrence,
  RecurringExpenseOccurrenceSchema,
} from './schemas/recurring-expense-occurrence.schema';

@Module({
  imports: [
    AccountsModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: RecurringExpense.name, schema: RecurringExpenseSchema },
      { name: RecurringExpenseOccurrence.name, schema: RecurringExpenseOccurrenceSchema },
    ]),
  ],
  controllers: [RecurringExpensesController],
  providers: [RecurringExpensesService],
  exports: [RecurringExpensesService],
})
export class RecurringExpensesModule {}
