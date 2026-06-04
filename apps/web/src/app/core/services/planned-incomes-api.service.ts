import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  PlannedIncomeAlerts,
  PlannedIncomeItem,
  PlannedIncomeOccurrence,
  PlannedIncomeSummary,
} from '../models/planned-income.model';

@Injectable({ providedIn: 'root' })
export class PlannedIncomesApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { isActive?: boolean }) {
    let httpParams = new HttpParams();
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', String(params.isActive));
    }
    return this.http.get<PlannedIncomeItem[]>(`${environment.apiUrl}/planned-incomes`, {
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
    return this.http.post<PlannedIncomeItem>(`${environment.apiUrl}/planned-incomes`, payload);
  }

  update(id: string, payload: Partial<PlannedIncomeItem>) {
    return this.http.patch<PlannedIncomeItem>(`${environment.apiUrl}/planned-incomes/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<PlannedIncomeItem>(`${environment.apiUrl}/planned-incomes/${id}`);
  }

  occurrences(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<PlannedIncomeOccurrence[]>(
      `${environment.apiUrl}/planned-incomes/occurrences`,
      { params: httpParams },
    );
  }

  confirmOccurrence(id: string, payload: { receivedAmount?: number; note?: string }) {
    return this.http.post<PlannedIncomeOccurrence>(
      `${environment.apiUrl}/planned-incomes/occurrences/${id}/confirm`,
      payload,
    );
  }

  omitOccurrence(id: string) {
    return this.http.post<PlannedIncomeOccurrence>(
      `${environment.apiUrl}/planned-incomes/occurrences/${id}/omit`,
      {},
    );
  }

  alerts(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<PlannedIncomeAlerts>(`${environment.apiUrl}/planned-incomes/alerts`, {
      params: httpParams,
    });
  }

  summary(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<PlannedIncomeSummary>(`${environment.apiUrl}/planned-incomes/summary`, {
      params: httpParams,
    });
  }
}
