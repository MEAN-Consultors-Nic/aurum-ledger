import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type IssueSeverity = 'info' | 'warning' | 'critical';

export type ReconcileIssue = {
  key: string;
  title: string;
  description: string;
  severity: IssueSeverity;
  count: number;
  affectedAmountUsd?: number;
  affectedAmountNio?: number;
  preview: Array<Record<string, unknown>>;
  fixDescription: string;
};

export type DiagnoseResult = {
  generatedAt: string;
  issues: ReconcileIssue[];
};

@Injectable({ providedIn: 'root' })
export class ReconcileApiService {
  private readonly base = `${environment.apiUrl}/reconcile`;

  constructor(private readonly http: HttpClient) {}

  diagnose() {
    return this.http.get<DiagnoseResult>(`${this.base}/diagnose`);
  }

  fix(issueKey: string) {
    return this.http.post<{ fixed: number }>(`${this.base}/fix/${issueKey}`, {});
  }
}
