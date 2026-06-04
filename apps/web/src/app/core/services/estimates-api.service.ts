import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { EstimateConvertResponse, EstimateItem, EstimateListResponse } from '../models/estimate.model';

@Injectable({ providedIn: 'root' })
export class EstimatesApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { clientId?: string; status?: string; search?: string; page?: number; limit?: number }) {
    let httpParams = new HttpParams();
    if (params?.clientId) {
      httpParams = httpParams.set('clientId', params.clientId);
    }
    if (params?.status) {
      httpParams = httpParams.set('status', params.status);
    }
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.page) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<EstimateListResponse>(`${environment.apiUrl}/estimates`, {
      params: httpParams,
    });
  }

  findById(id: string) {
    return this.http.get<EstimateItem>(`${environment.apiUrl}/estimates/${id}`);
  }

  create(payload: {
    clientId: string;
    serviceId: string;
    title?: string;
    billingPeriod: 'monthly' | 'annual' | 'one_time';
    amount: number;
    currency?: 'USD' | 'NIO';
    status?: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired';
    notes?: string;
  }) {
    return this.http.post<EstimateItem>(`${environment.apiUrl}/estimates`, payload);
  }

  update(id: string, payload: Partial<EstimateItem>) {
    return this.http.patch<EstimateItem>(`${environment.apiUrl}/estimates/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<EstimateItem>(`${environment.apiUrl}/estimates/${id}`);
  }

  convert(id: string, payload: {
    amount?: number;
    currency?: 'USD' | 'NIO';
    billingPeriod?: 'monthly' | 'annual' | 'one_time';
    startDate: string;
    endDate?: string;
    contractNotes?: string;
    conversionNotes?: string;
    createProject?: boolean;
    createGithubRepo?: boolean;
  }) {
    return this.http.post<EstimateConvertResponse>(`${environment.apiUrl}/estimates/${id}/convert`, payload);
  }

  generateShare(id: string) {
    return this.http.post<{
      shareToken: string;
      shareCreatedAt: string;
      shareRevokedAt?: string;
      shareViewCount: number;
      shareLastViewedAt?: string;
    }>(`${environment.apiUrl}/estimates/${id}/share`, {});
  }

  revokeShare(id: string) {
    return this.http.delete<{ revoked: boolean }>(`${environment.apiUrl}/estimates/${id}/share`);
  }
}
