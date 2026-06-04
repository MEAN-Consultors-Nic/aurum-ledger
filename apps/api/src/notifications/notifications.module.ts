import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PlannedIncomesModule } from '../planned-incomes/planned-incomes.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { LoansModule } from '../loans/loans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { Estimate, EstimateSchema } from '../estimates/schemas/estimate.schema';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    PlannedIncomesModule,
    RecurringExpensesModule,
    BudgetsModule,
    LoansModule,
    SubscriptionsModule,
    MongooseModule.forFeature([
      { name: Contract.name, schema: ContractSchema },
      { name: Estimate.name, schema: EstimateSchema },
    ]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
