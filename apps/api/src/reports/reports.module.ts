import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../accounts/schemas/account.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceSchema,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Account.name, schema: AccountSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: PlannedIncomeOccurrence.name, schema: PlannedIncomeOccurrenceSchema },
    ]),
  ],
  controllers: [ReportsController],
  providers: [ReportsService],
})
export class ReportsModule {}
