import { Injectable } from '@nestjs/common';
import { PlannedIncomesService } from '../planned-incomes/planned-incomes.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly plannedIncomesService: PlannedIncomesService) {}

  async getNotifications(month?: string) {
    const plannedIncomeAlerts = await this.plannedIncomesService.getAlerts(month);
    return {
      plannedIncome: plannedIncomeAlerts,
    };
  }
}
