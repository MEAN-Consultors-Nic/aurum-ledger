import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { LoanAlerts, LoanItem, LoanPaymentOccurrence } from '../models/loan.model';

@Injectable({ providedIn: 'root' })
export class LoansApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { isActive?: boolean }) {
    let httpParams = new HttpParams();
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', String(params.isActive));
    }
    return this.http.get<LoanItem[]>(`${environment.apiUrl}/loans`, { params: httpParams });
  }

  create(payload: {
    name: string;
    principal: number;
    installmentAmount: number;
    currency: 'USD' | 'NIO';
    accountId: string;
    categoryId: string;
    daysOfMonth: number[];
    notes?: string;
    isActive?: boolean;
  }) {
    return this.http.post<LoanItem>(`${environment.apiUrl}/loans`, payload);
  }

  update(id: string, payload: Partial<LoanItem>) {
    return this.http.patch<LoanItem>(`${environment.apiUrl}/loans/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<LoanItem>(`${environment.apiUrl}/loans/${id}`);
  }

  occurrences(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<LoanPaymentOccurrence[]>(`${environment.apiUrl}/loans/occurrences`, {
      params: httpParams,
    });
  }

  confirmOccurrence(id: string) {
    return this.http.post<LoanPaymentOccurrence>(`${environment.apiUrl}/loans/occurrences/${id}/confirm`, {});
  }

  omitOccurrence(id: string) {
    return this.http.post<LoanPaymentOccurrence>(`${environment.apiUrl}/loans/occurrences/${id}/omit`, {});
  }

  alerts(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<LoanAlerts>(`${environment.apiUrl}/loans/alerts`, { params: httpParams });
  }
}
