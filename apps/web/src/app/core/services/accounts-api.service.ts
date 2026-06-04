import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AccountItem } from '../models/account.model';

@Injectable({ providedIn: 'root' })
export class AccountsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { isActive?: boolean; includeBalance?: boolean }) {
    let httpParams = new HttpParams();
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', String(params.isActive));
    }
    if (params?.includeBalance) {
      httpParams = httpParams.set('includeBalance', 'true');
    }
    return this.http.get<AccountItem[]>(`${environment.apiUrl}/accounts`, { params: httpParams });
  }

  create(payload: {
    name: string;
    type: 'bank' | 'paypal' | 'cash' | 'other';
    currency: 'USD' | 'NIO';
    bankName?: string;
    initialBalance?: number;
    isActive?: boolean;
  }) {
    return this.http.post<AccountItem>(`${environment.apiUrl}/accounts`, payload);
  }

  update(id: string, payload: Partial<AccountItem>) {
    return this.http.patch<AccountItem>(`${environment.apiUrl}/accounts/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<AccountItem>(`${environment.apiUrl}/accounts/${id}`);
  }

  resetBalance(id: string, payload: { currentBalance: number; note?: string }) {
    return this.http.post(`${environment.apiUrl}/accounts/${id}/reset`, payload);
  }
}
