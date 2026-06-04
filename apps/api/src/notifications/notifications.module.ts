import { Module } from '@nestjs/common';
import { PlannedIncomesModule } from '../planned-incomes/planned-incomes.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { LoansModule } from '../loans/loans.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [
    PlannedIncomesModule,
    RecurringExpensesModule,
    BudgetsModule,
    LoansModule,
    SubscriptionsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
