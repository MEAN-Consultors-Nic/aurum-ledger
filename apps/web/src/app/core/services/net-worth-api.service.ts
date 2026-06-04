import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { NetWorthCurrent, NetWorthSnapshot } from '../models/net-worth.model';

@Injectable({ providedIn: 'root' })
export class NetWorthApiService {
  private readonly base = `${environment.apiUrl}/net-worth`;

  constructor(private readonly http: HttpClient) {}

  current() {
    return this.http.get<NetWorthCurrent>(`${this.base}/current`);
  }

  history(days = 90) {
    const params = new HttpParams().set('days', String(days));
    return this.http.get<NetWorthSnapshot[]>(`${this.base}/history`, { params });
  }

  takeSnapshot() {
    return this.http.post<NetWorthSnapshot>(`${this.base}/snapshot`, {});
  }
}
