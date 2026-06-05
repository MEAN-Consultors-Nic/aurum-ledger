import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ConvertToEstimatePayload,
  CreateSiteAuditPayload,
  SiteAudit,
} from '../models/site-audit.model';

@Injectable({ providedIn: 'root' })
export class SiteAuditApiService {
  private readonly base = `${environment.apiUrl}/site-audits`;

  constructor(private readonly http: HttpClient) {}

  list(opts: { status?: string; q?: string } = {}) {
    let params = new HttpParams();
    if (opts.status) params = params.set('status', opts.status);
    if (opts.q) params = params.set('q', opts.q);
    return this.http.get<SiteAudit[]>(this.base, { params });
  }

  findOne(id: string) {
    return this.http.get<SiteAudit>(`${this.base}/${id}`);
  }

  create(payload: CreateSiteAuditPayload) {
    return this.http.post<SiteAudit>(this.base, payload);
  }

  regenerateAi(id: string) {
    return this.http.post<SiteAudit>(`${this.base}/${id}/regenerate-ai`, {});
  }

  convertToEstimate(id: string, payload: ConvertToEstimatePayload) {
    return this.http.post<{ estimateId: string; amount: number; totalHours: number }>(
      `${this.base}/${id}/convert-to-estimate`,
      payload,
    );
  }

  remove(id: string) {
    return this.http.delete<{ _id: string; deleted: boolean }>(`${this.base}/${id}`);
  }
}
