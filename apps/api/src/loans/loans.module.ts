import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { Loan, LoanSchema } from './schemas/loan.schema';
import { LoanPaymentOccurrence, LoanPaymentOccurrenceSchema } from './schemas/loan-payment-occurrence.schema';

@Module({
  imports: [
    AccountsModule,
    RecurringExpensesModule,
    TransactionsModule,
    MongooseModule.forFeature([
      { name: Loan.name, schema: LoanSchema },
      { name: LoanPaymentOccurrence.name, schema: LoanPaymentOccurrenceSchema },
    ]),
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService],
})
export class LoansModule {}
