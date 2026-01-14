import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AccountsModule } from '../accounts/accounts.module';
import { ContractsModule } from '../contracts/contracts.module';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { Payment, PaymentSchema } from '../payments/schemas/payment.schema';
import { Transaction, TransactionSchema } from './schemas/transaction.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Transaction.name, schema: TransactionSchema },
      { name: Payment.name, schema: PaymentSchema },
    ]),
    AccountsModule,
    ContractsModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}
