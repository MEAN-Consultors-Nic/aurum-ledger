import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  LoanAlerts,
  LoanItem,
  LoanPayload,
  LoanPaymentOccurrence,
  LoanSchedule,
} from '../models/loan.model';

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

  get(id: string) {
    return this.http.get<LoanItem>(`${environment.apiUrl}/loans/${id}`);
  }

  create(payload: LoanPayload) {
    return this.http.post<LoanItem>(`${environment.apiUrl}/loans`, payload);
  }

  update(id: string, payload: Partial<LoanPayload>) {
    return this.http.patch<LoanItem>(`${environment.apiUrl}/loans/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<LoanItem>(`${environment.apiUrl}/loans/${id}`);
  }

  /** History plus, for an open-payment loan, a simulation of what follows. */
  schedule(id: string, paymentPerPeriod?: number) {
    let httpParams = new HttpParams();
    if (paymentPerPeriod) {
      httpParams = httpParams.set('paymentPerPeriod', String(paymentPerPeriod));
    }
    return this.http.get<LoanSchedule>(`${environment.apiUrl}/loans/${id}/schedule`, {
      params: httpParams,
    });
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

  confirmOccurrence(id: string, payload: { paidAmount?: number; paidDate?: string; note?: string } = {}) {
    return this.http.post<LoanPaymentOccurrence>(
      `${environment.apiUrl}/loans/occurrences/${id}/confirm`,
      payload,
    );
  }

  omitOccurrence(id: string) {
    return this.http.post<LoanPaymentOccurrence>(
      `${environment.apiUrl}/loans/occurrences/${id}/omit`,
      {},
    );
  }

  reactivateOccurrence(id: string) {
    return this.http.post<LoanPaymentOccurrence>(
      `${environment.apiUrl}/loans/occurrences/${id}/reactivate`,
      {},
    );
  }

  alerts(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<LoanAlerts>(`${environment.apiUrl}/loans/alerts`, { params: httpParams });
  }
}
