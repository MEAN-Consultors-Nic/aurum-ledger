import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ContractItem, ContractListResponse } from '../models/contract.model';

@Injectable({ providedIn: 'root' })
export class ContractsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: {
    clientId?: string;
    status?: string;
    dueFrom?: string;
    dueTo?: string;
    search?: string;
    onlyOpen?: boolean;
    page?: number;
    limit?: number;
  }) {
    let httpParams = new HttpParams();
    if (params?.clientId) {
      httpParams = httpParams.set('clientId', params.clientId);
    }
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.dueFrom) {
      httpParams = httpParams.set('dueFrom', params.dueFrom);
    }
    if (params?.dueTo) {
      httpParams = httpParams.set('dueTo', params.dueTo);
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.onlyOpen) {
      httpParams = httpParams.set('onlyOpen', 'true');
    }
    if (params?.page) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<ContractListResponse>(`${environment.apiUrl}/contracts`, {
      params: httpParams,
    });
  }

  create(payload: {
    clientId: string;
    serviceId: string;
    title?: string;
    billingPeriod: 'monthly' | 'annual' | 'one_time';
    amount: number;
    currency?: 'USD' | 'NIO';
    startDate: string;
    endDate?: string;
    status?: 'active' | 'expired' | 'cancelled';
    notes?: string;
  }) {
    return this.http.post<ContractItem>(`${environment.apiUrl}/contracts`, payload);
  }

  update(id: string, payload: Partial<ContractItem>) {
    return this.http.patch<ContractItem>(`${environment.apiUrl}/contracts/${id}`, payload);
  }

  cancel(id: string) {
    return this.http.patch<ContractItem>(`${environment.apiUrl}/contracts/${id}/cancel`, {});
  }

  remove(id: string) {
    return this.http.delete<ContractItem>(`${environment.apiUrl}/contracts/${id}`);
  }
}
