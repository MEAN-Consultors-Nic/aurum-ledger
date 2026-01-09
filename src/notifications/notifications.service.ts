import { Injectable } from '@nestjs/common';
import { PlannedIncomesService } from '../planned-incomes/planned-incomes.service';
import { BudgetsService } from '../budgets/budgets.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly plannedIncomesService: PlannedIncomesService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly budgetsService: BudgetsService,
  ) {}

  async getNotifications(month?: string) {
    const plannedIncomeAlerts = await this.plannedIncomesService.getAlerts(month);
    const recurringExpenseAlerts = await this.recurringExpensesService.getAlerts(month);
    const [year, monthValue] = month ? month.split('-') : [];
    const budgetAlerts = await this.budgetsService.getAlerts({
      month: monthValue ? Number(monthValue) : undefined,
      year: year ? Number(year) : undefined,
    });
    return {
      plannedIncome: plannedIncomeAlerts,
      recurringExpense: recurringExpenseAlerts,
      budget: budgetAlerts,
    };
  }
}
