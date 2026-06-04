import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Account, AccountSchema } from '../accounts/schemas/account.schema';
import { AssetsModule } from '../assets/assets.module';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceSchema,
} from '../loans/schemas/loan-payment-occurrence.schema';
import { Loan, LoanSchema } from '../loans/schemas/loan.schema';
import { SettingsModule } from '../settings/settings.module';
import { Transaction, TransactionSchema } from '../transactions/schemas/transaction.schema';
import { NetWorthController } from './net-worth.controller';
import { NetWorthSchedulerService } from './net-worth-scheduler.service';
import { NetWorthService } from './net-worth.service';
import {
  NetWorthSnapshot,
  NetWorthSnapshotSchema,
} from './schemas/net-worth-snapshot.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NetWorthSnapshot.name, schema: NetWorthSnapshotSchema },
      // Read-only refs for live calculation.
      { name: Account.name, schema: AccountSchema },
      { name: Transaction.name, schema: TransactionSchema },
      { name: Loan.name, schema: LoanSchema },
      { name: LoanPaymentOccurrence.name, schema: LoanPaymentOccurrenceSchema },
    ]),
    AssetsModule,
    SettingsModule,
  ],
  controllers: [NetWorthController],
  providers: [NetWorthService, NetWorthSchedulerService],
  exports: [NetWorthService],
})
export class NetWorthModule {}
