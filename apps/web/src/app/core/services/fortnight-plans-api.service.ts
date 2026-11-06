import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ApplyLinePayload,
  CreatePlanLinePayload,
  FortnightAnalytics,
  FortnightDetail,
  RecordUnplannedPayload,
} from '../models/fortnight-plan.model';

/** Every mutation returns the refreshed fortnight, so the page re-renders from one source. */
@Injectable({ providedIn: 'root' })
export class FortnightPlansApiService {
  private readonly base = `${environment.apiUrl}/fortnight-plans`;

  constructor(private readonly http: HttpClient) {}

  get(periodKey: string) {
    return this.http.get<FortnightDetail>(`${this.base}/${periodKey}`);
  }

  open(periodKey: string) {
    return this.http.post<FortnightDetail>(this.base, { periodKey });
  }

  sync(periodKey: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/sync`, {});
  }

  updateNotes(periodKey: string, notes: string) {
    return this.http.patch<FortnightDetail>(`${this.base}/${periodKey}`, { notes });
  }

  close(periodKey: string, pending: 'carry' | 'skip') {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/close`, { pending });
  }

  reopen(periodKey: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/reopen`, {});
  }

  /** Finishes the planning wizard. */
  confirm(periodKey: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/confirm`, {});
  }

  remove(periodKey: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${periodKey}`);
  }

  addLine(periodKey: string, payload: CreatePlanLinePayload) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines`, payload);
  }

  updateLine(periodKey: string, lineId: string, payload: Partial<CreatePlanLinePayload>) {
    return this.http.patch<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}`, payload);
  }

  removeLine(periodKey: string, lineId: string) {
    return this.http.delete<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}`);
  }

  apply(periodKey: string, lineId: string, payload: ApplyLinePayload) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/apply`, payload);
  }

  unapply(periodKey: string, lineId: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/unapply`, {});
  }

  skip(periodKey: string, lineId: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/skip`, {});
  }

  restore(periodKey: string, lineId: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/restore`, {});
  }

  omit(periodKey: string, lineId: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/omit`, {});
  }

  carry(periodKey: string, lineId: string) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/carry`, {});
  }

  promote(periodKey: string, lineId: string, daysOfMonth: number[]) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/lines/${lineId}/promote`, { daysOfMonth });
  }

  recordUnplanned(periodKey: string, payload: RecordUnplannedPayload) {
    return this.http.post<FortnightDetail>(`${this.base}/${periodKey}/unplanned`, payload);
  }

  analytics(limit = 12) {
    return this.http.get<FortnightAnalytics>(`${this.base}/analytics`, {
      params: new HttpParams().set('limit', String(limit)),
    });
  }
}
