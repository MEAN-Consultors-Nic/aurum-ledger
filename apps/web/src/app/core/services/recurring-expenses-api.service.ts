import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  RecurringExpenseAlerts,
  RecurringExpenseItem,
  RecurringExpenseOccurrence,
} from '../models/recurring-expense.model';

@Injectable({ providedIn: 'root' })
export class RecurringExpensesApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { isActive?: boolean }) {
    let httpParams = new HttpParams();
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', String(params.isActive));
    }
    return this.http.get<RecurringExpenseItem[]>(`${environment.apiUrl}/recurring-expenses`, {
      params: httpParams,
    });
  }

  create(payload: {
    name: string;
    amount: number;
    currency: 'USD' | 'NIO';
    accountId: string;
    categoryId: string;
    daysOfMonth: number[];
    notes?: string;
    isActive?: boolean;
  }) {
    return this.http.post<RecurringExpenseItem>(`${environment.apiUrl}/recurring-expenses`, payload);
  }

  update(id: string, payload: Partial<RecurringExpenseItem>) {
    return this.http.patch<RecurringExpenseItem>(`${environment.apiUrl}/recurring-expenses/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<RecurringExpenseItem>(`${environment.apiUrl}/recurring-expenses/${id}`);
  }

  occurrences(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<RecurringExpenseOccurrence[]>(
      `${environment.apiUrl}/recurring-expenses/occurrences`,
      { params: httpParams },
    );
  }

  confirmOccurrence(id: string) {
    return this.http.post<RecurringExpenseOccurrence>(
      `${environment.apiUrl}/recurring-expenses/occurrences/${id}/confirm`,
      {},
    );
  }

  omitOccurrence(id: string) {
    return this.http.post<RecurringExpenseOccurrence>(
      `${environment.apiUrl}/recurring-expenses/occurrences/${id}/omit`,
      {},
    );
  }

  alerts(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<RecurringExpenseAlerts>(`${environment.apiUrl}/recurring-expenses/alerts`, {
      params: httpParams,
    });
  }
}
