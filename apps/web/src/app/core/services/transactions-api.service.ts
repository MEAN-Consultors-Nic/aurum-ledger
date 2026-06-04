import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { TransactionItem } from '../models/transaction.model';

@Injectable({ providedIn: 'root' })
export class TransactionsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: {
    accountId?: string;
    type?: string;
    categoryId?: string;
    clientId?: string;
    contractId?: string;
    from?: string;
    to?: string;
    sortField?: 'date' | 'amount' | 'type' | 'accountId' | 'categoryId' | 'notes';
    sortDirection?: 'asc' | 'desc';
  }) {
    let httpParams = new HttpParams();
    if (params?.accountId) {
      httpParams = httpParams.set('accountId', params.accountId);
    }
    if (params?.type) {
      httpParams = httpParams.set('type', params.type);
    }
    if (params?.categoryId) {
      httpParams = httpParams.set('categoryId', params.categoryId);
    }
    if (params?.clientId) {
      httpParams = httpParams.set('clientId', params.clientId);
    }
    if (params?.contractId) {
      httpParams = httpParams.set('contractId', params.contractId);
    }
    if (params?.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params?.to) {
      httpParams = httpParams.set('to', params.to);
    }
    if (params?.sortField) {
      httpParams = httpParams.set('sortField', params.sortField);
    }
    if (params?.sortDirection) {
      httpParams = httpParams.set('sortDirection', params.sortDirection);
    }
    return this.http.get<TransactionItem[]>(`${environment.apiUrl}/transactions`, { params: httpParams });
  }

  create(payload: {
    type: 'income' | 'expense' | 'adjustment';
    accountId: string;
    categoryId?: string;
    amount: number;
    currency: 'USD' | 'NIO';
    exchangeRate?: number;
    date: string;
    reference?: string;
    notes?: string;
    linkedClientId?: string;
    linkedContractId?: string;
    flow?: 'in' | 'out';
  }) {
    return this.http.post<TransactionItem>(`${environment.apiUrl}/transactions`, payload);
  }

  transfer(payload: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    currency: 'USD' | 'NIO';
    exchangeRate?: number;
    date: string;
    reference?: string;
    notes?: string;
  }) {
    return this.http.post<{ out: TransactionItem; in: TransactionItem }>(
      `${environment.apiUrl}/transactions/transfer`,
      payload,
    );
  }

  void(id: string) {
    return this.http.patch<{ success: boolean }>(`${environment.apiUrl}/transactions/${id}/void`, {});
  }
}
