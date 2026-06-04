import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ServiceItem } from '../models/service.model';

@Injectable({ providedIn: 'root' })
export class ServicesApiService {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<ServiceItem[]>(`${environment.apiUrl}/services`);
  }

  create(payload: {
    name: string;
    billingType: 'recurring' | 'one_time';
    defaultPeriod?: 'monthly' | 'annual' | 'one_time';
    description?: string;
  }) {
    return this.http.post<ServiceItem>(`${environment.apiUrl}/services`, payload);
  }

  update(id: string, payload: Partial<ServiceItem>) {
    return this.http.patch<ServiceItem>(
      `${environment.apiUrl}/services/${id}`,
      payload,
    );
  }

  remove(id: string) {
    return this.http.delete<ServiceItem>(`${environment.apiUrl}/services/${id}`);
  }
}
