import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { DashboardOverview } from '../models/dashboard.model';
import { PaymentsReportResponse, ProjectionItem, ReceivableItem, TrendItem } from '../models/report.model';

@Injectable({ providedIn: 'root' })
export class ReportsApiService {
  constructor(private readonly http: HttpClient) {}

  receivables(groupBy: 'client' | 'service') {
    const params = new HttpParams().set('groupBy', groupBy);
    return this.http.get<ReceivableItem[]>(`${environment.apiUrl}/reports/receivables`, { params });
  }

  dashboardOverview() {
    return this.http.get<DashboardOverview>(`${environment.apiUrl}/dashboard/overview`);
  }

  paymentsReport(from?: string, to?: string) {
    let params = new HttpParams();
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<PaymentsReportResponse>(`${environment.apiUrl}/reports/payments`, { params });
  }

  trends(months = 6) {
    const params = new HttpParams().set('months', String(months));
    return this.http.get<TrendItem[]>(`${environment.apiUrl}/reports/trends`, { params });
  }

  projections(month?: string) {
    let params = new HttpParams();
    if (month) {
      params = params.set('month', month);
    }
    return this.http.get<ProjectionItem>(`${environment.apiUrl}/reports/projections`, { params });
  }
}
