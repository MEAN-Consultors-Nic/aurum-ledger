import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { PaymentItem, PaymentListResponse } from '../models/payment.model';

@Injectable({ providedIn: 'root' })
export class PaymentsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: {
    clientId?: string;
    contractId?: string;
    accountId?: string;
    from?: string;
    to?: string;
    page?: number;
    limit?: number;
  }) {
    let httpParams = new HttpParams();
    if (params?.clientId) {
      httpParams = httpParams.set('clientId', params.clientId);
    }
    if (params?.contractId) {
      httpParams = httpParams.set('contractId', params.contractId);
    }
    if (params?.accountId) {
      httpParams = httpParams.set('accountId', params.accountId);
    }
    if (params?.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params?.to) {
      httpParams = httpParams.set('to', params.to);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<PaymentListResponse>(`${environment.apiUrl}/payments`, {
      params: httpParams,
    });
  }

  create(payload: {
    contractId: string;
    clientId: string;
    accountId?: string;
    amount: number;
    retentionAmount?: number;
    currency: 'USD' | 'NIO';
    exchangeRate: number;
    paymentDate: string;
    method: 'cash' | 'bank' | 'paypal' | 'card' | 'transfer' | 'other';
    reference?: string;
    notes?: string;
  }) {
    return this.http.post<PaymentItem>(`${environment.apiUrl}/payments`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ success: boolean }>(`${environment.apiUrl}/payments/${id}`);
  }
}
