import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SiteMonitorItem } from '../models/site-monitor.model';

export type CreateSiteMonitorPayload = {
  name: string;
  url: string;
  projectId?: string;
  isActive?: boolean;
  domainExpiresAt?: string;
  sslWarnDays?: number;
  domainWarnDays?: number;
};

export type UpdateSiteMonitorPayload = Partial<CreateSiteMonitorPayload>;

@Injectable({ providedIn: 'root' })
export class SiteMonitorApiService {
  private readonly base = `${environment.apiUrl}/site-monitor`;

  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<SiteMonitorItem[]>(this.base);
  }

  create(payload: CreateSiteMonitorPayload) {
    return this.http.post<SiteMonitorItem>(this.base, payload);
  }

  update(id: string, payload: UpdateSiteMonitorPayload) {
    return this.http.patch<SiteMonitorItem>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<SiteMonitorItem>(`${this.base}/${id}`);
  }

  checkNow(id: string) {
    return this.http.post<SiteMonitorItem>(`${this.base}/${id}/check`, {});
  }
}
