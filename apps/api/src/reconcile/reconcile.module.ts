import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../accounts/schemas/account.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceSchema,
} from '../loans/schemas/loan-payment-occurrence.schema';
import { Loan, LoanSchema } from '../loans/schemas/loan.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceSchema,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import {
  PlannedIncome,
  PlannedIncomeSchema,
} from '../planned-incomes/schemas/planned-income.schema';
import {
  RecurringExpenseOccurrence,
  RecurringExpenseOccurrenceSchema,
} from '../recurring-expenses/schemas/recurring-expense-occurrence.schema';
import {
  RecurringExpense,
  RecurringExpenseSchema,
} from '../recurring-expenses/schemas/recurring-expense.schema';
import {
  SubscriptionOccurrence,
  SubscriptionOccurrenceSchema,
} from '../subscriptions/schemas/subscription-occurrence.schema';
import { Subscription, SubscriptionSchema } from '../subscriptions/schemas/subscription.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { ReconcileController } from './reconcile.controller';
import { ReconcileService } from './reconcile.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: PlannedIncome.name, schema: PlannedIncomeSchema },
      { name: PlannedIncomeOccurrence.name, schema: PlannedIncomeOccurrenceSchema },
      { name: RecurringExpense.name, schema: RecurringExpenseSchema },
      { name: RecurringExpenseOccurrence.name, schema: RecurringExpenseOccurrenceSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: SubscriptionOccurrence.name, schema: SubscriptionOccurrenceSchema },
      { name: Loan.name, schema: LoanSchema },
      { name: LoanPaymentOccurrence.name, schema: LoanPaymentOccurrenceSchema },
    ]),
  ],
  controllers: [ReconcileController],
  providers: [ReconcileService],
})
export class ReconcileModule {}
