import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PlannedIncomeAlerts } from '../models/planned-income.model';
import { BudgetAlerts, RecurringExpenseAlerts } from '../models/recurring-expense.model';
import { LoanAlerts } from '../models/loan.model';
import { SubscriptionAlerts } from '../models/subscription.model';

export type NotificationsResponse = {
  plannedIncome: PlannedIncomeAlerts;
  recurringExpense: RecurringExpenseAlerts;
  budget: BudgetAlerts;
  loans: LoanAlerts;
  subscriptions: SubscriptionAlerts;
};

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  constructor(private readonly http: HttpClient) {}

  getNotifications(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<NotificationsResponse>(`${environment.apiUrl}/notifications`, {
      params: httpParams,
    });
  }
}
