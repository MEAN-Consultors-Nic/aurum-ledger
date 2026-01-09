import { Module } from '@nestjs/common';
import { PlannedIncomesModule } from '../planned-incomes/planned-incomes.module';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringExpensesModule } from '../recurring-expenses/recurring-expenses.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PlannedIncomesModule, RecurringExpensesModule, BudgetsModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
