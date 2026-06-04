import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ClientItem, ClientListResponse } from '../models/client.model';

@Injectable({ providedIn: 'root' })
export class ClientsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { search?: string; isActive?: boolean; page?: number; limit?: number }) {
    let httpParams = new HttpParams();
    if (params?.search) {
      httpParams = httpParams.set('search', params.search);
    }
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', String(params.isActive));
    }
    if (params?.page) {
      httpParams = httpParams.set('page', String(params.page));
    }
    if (params?.limit) {
      httpParams = httpParams.set('limit', String(params.limit));
    }

    return this.http.get<ClientListResponse>(`${environment.apiUrl}/clients`, {
      params: httpParams,
    });
  }

  create(payload: {
    name: string;
    contactName?: string;
    email?: string;
    phone?: string;
    notes?: string;
    tags?: string[];
  }) {
    return this.http.post<ClientItem>(`${environment.apiUrl}/clients`, payload);
  }

  update(id: string, payload: Partial<ClientItem>) {
    return this.http.patch<ClientItem>(`${environment.apiUrl}/clients/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<ClientItem>(`${environment.apiUrl}/clients/${id}`);
  }
}
