import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SubscriptionAlerts, SubscriptionItem, SubscriptionOccurrence } from '../models/subscription.model';

@Injectable({ providedIn: 'root' })
export class SubscriptionsApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { isActive?: boolean }) {
    let httpParams = new HttpParams();
    if (params?.isActive !== undefined) {
      httpParams = httpParams.set('isActive', String(params.isActive));
    }
    return this.http.get<SubscriptionItem[]>(`${environment.apiUrl}/subscriptions`, { params: httpParams });
  }

  create(payload: {
    name: string;
    amount: number;
    currency: 'USD' | 'NIO';
    accountId: string;
    categoryId: string;
    daysOfMonth: number[];
    notes?: string;
    isActive?: boolean;
  }) {
    return this.http.post<SubscriptionItem>(`${environment.apiUrl}/subscriptions`, payload);
  }

  update(id: string, payload: Partial<SubscriptionItem>) {
    return this.http.patch<SubscriptionItem>(`${environment.apiUrl}/subscriptions/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<SubscriptionItem>(`${environment.apiUrl}/subscriptions/${id}`);
  }

  occurrences(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<SubscriptionOccurrence[]>(`${environment.apiUrl}/subscriptions/occurrences`, {
      params: httpParams,
    });
  }

  confirmOccurrence(id: string) {
    return this.http.post<SubscriptionOccurrence>(
      `${environment.apiUrl}/subscriptions/occurrences/${id}/confirm`,
      {},
    );
  }

  omitOccurrence(id: string) {
    return this.http.post<SubscriptionOccurrence>(
      `${environment.apiUrl}/subscriptions/occurrences/${id}/omit`,
      {},
    );
  }

  alerts(month?: string) {
    let httpParams = new HttpParams();
    if (month) {
      httpParams = httpParams.set('month', month);
    }
    return this.http.get<SubscriptionAlerts>(`${environment.apiUrl}/subscriptions/alerts`, { params: httpParams });
  }
}
