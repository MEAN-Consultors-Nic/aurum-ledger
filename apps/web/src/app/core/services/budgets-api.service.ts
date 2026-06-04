import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { BudgetItem } from '../models/budget.model';

@Injectable({ providedIn: 'root' })
export class BudgetsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { month?: number; year?: number }) {
    let httpParams = new HttpParams();
    if (params?.month) {
      httpParams = httpParams.set('month', String(params.month));
    }
    if (params?.year) {
      httpParams = httpParams.set('year', String(params.year));
    }
    return this.http.get<BudgetItem[]>(`${environment.apiUrl}/budgets`, { params: httpParams });
  }

  create(payload: {
    categoryId: string;
    month: number;
    year: number;
    amount: number;
    currency: 'USD' | 'NIO';
  }) {
    return this.http.post<BudgetItem>(`${environment.apiUrl}/budgets`, payload);
  }

  update(id: string, payload: Partial<BudgetItem>) {
    return this.http.patch<BudgetItem>(`${environment.apiUrl}/budgets/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<BudgetItem>(`${environment.apiUrl}/budgets/${id}`);
  }
}
