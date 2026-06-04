import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  FinanceByCategoryItem,
  FinanceByClientItem,
  FinanceByContractItem,
  FinanceOverview,
} from '../models/finance.model';

@Injectable({ providedIn: 'root' })
export class FinanceApiService {
  constructor(private readonly http: HttpClient) {}

  overview() {
    return this.http.get<FinanceOverview>(`${environment.apiUrl}/finance/overview`);
  }

  byCategory(params?: { month?: number; year?: number }) {
    let httpParams = new HttpParams();
    if (params?.month) {
      httpParams = httpParams.set('month', String(params.month));
    }
    if (params?.year) {
      httpParams = httpParams.set('year', String(params.year));
    }
    return this.http.get<FinanceByCategoryItem[]>(`${environment.apiUrl}/finance/by-category`, {
      params: httpParams,
    });
  }

  byClient(params?: { from?: string; to?: string }) {
    let httpParams = new HttpParams();
    if (params?.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params?.to) {
      httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<FinanceByClientItem[]>(`${environment.apiUrl}/finance/by-client`, {
      params: httpParams,
    });
  }

  byContract(params?: { from?: string; to?: string }) {
    let httpParams = new HttpParams();
    if (params?.from) {
      httpParams = httpParams.set('from', params.from);
    }
    if (params?.to) {
      httpParams = httpParams.set('to', params.to);
    }
    return this.http.get<FinanceByContractItem[]>(`${environment.apiUrl}/finance/by-contract`, {
      params: httpParams,
    });
  }
}
