import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type PublicEstimate = {
  title: string;
  clientName: string;
  serviceName: string;
  billingPeriod: 'monthly' | 'annual' | 'one_time';
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';
  scope: string;
  deliverables: string[];
  terms: string;
  validUntil?: string | null;
  sentAt?: string | null;
};

export type PublicProjectTask = {
  title: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority?: 'low' | 'medium' | 'high';
};

export type PublicProjectDeliverable = {
  label: string;
  done: boolean;
  doneAt?: string | null;
};

export type PublicProject = {
  name: string;
  description: string;
  clientName: string;
  serviceName: string;
  contractTitle: string;
  status: 'active' | 'on_hold' | 'completed' | 'archived';
  progress: number;
  startDate?: string | null;
  dueDate?: string | null;
  tags: string[];
  deliverables: PublicProjectDeliverable[];
  tasks: PublicProjectTask[];
};

@Injectable({ providedIn: 'root' })
export class PublicApiService {
  private readonly base = `${environment.apiUrl}/public`;

  constructor(private readonly http: HttpClient) {}

  getEstimate(token: string) {
    return this.http.get<PublicEstimate>(`${this.base}/estimates/${token}`);
  }

  getProject(token: string) {
    return this.http.get<PublicProject>(`${this.base}/projects/${token}`);
  }
}
