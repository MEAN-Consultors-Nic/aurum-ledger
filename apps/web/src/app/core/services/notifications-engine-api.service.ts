import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  EventDefinition,
  NotificationLogEntry,
  NotificationRule,
  NotificationTemplate,
  RenderPreview,
  SendTestResult,
  TemplateGroup,
} from '../models/notification-engine.model';

@Injectable({ providedIn: 'root' })
export class NotificationsEngineApiService {
  private readonly base = `${environment.apiUrl}/notification-center`;

  constructor(private readonly http: HttpClient) {}

  // events
  events() {
    return this.http.get<EventDefinition[]>(`${this.base}/events`);
  }

  // groups
  listGroups() {
    return this.http.get<TemplateGroup[]>(`${this.base}/groups`);
  }
  createGroup(payload: { name: string; description?: string; color?: string; order?: number }) {
    return this.http.post<TemplateGroup>(`${this.base}/groups`, payload);
  }
  updateGroup(id: string, payload: Partial<TemplateGroup>) {
    return this.http.patch<TemplateGroup>(`${this.base}/groups/${id}`, payload);
  }
  deleteGroup(id: string) {
    return this.http.delete<TemplateGroup>(`${this.base}/groups/${id}`);
  }

  // templates
  listTemplates(params?: { groupId?: string; eventKey?: string }) {
    let httpParams = new HttpParams();
    if (params?.groupId) httpParams = httpParams.set('groupId', params.groupId);
    if (params?.eventKey) httpParams = httpParams.set('eventKey', params.eventKey);
    return this.http.get<NotificationTemplate[]>(`${this.base}/templates`, { params: httpParams });
  }
  findTemplate(id: string) {
    return this.http.get<NotificationTemplate>(`${this.base}/templates/${id}`);
  }
  createTemplate(payload: Partial<NotificationTemplate>) {
    return this.http.post<NotificationTemplate>(`${this.base}/templates`, payload);
  }
  updateTemplate(id: string, payload: Partial<NotificationTemplate>) {
    return this.http.patch<NotificationTemplate>(`${this.base}/templates/${id}`, payload);
  }
  deleteTemplate(id: string) {
    return this.http.delete<NotificationTemplate>(`${this.base}/templates/${id}`);
  }
  preview(payload: { subject: string; bodyHtml: string; bodyText?: string; eventKey?: string }) {
    return this.http.post<RenderPreview>(`${this.base}/templates/preview`, payload);
  }
  testSend(id: string, payload: { to: string }) {
    return this.http.post<SendTestResult>(`${this.base}/templates/${id}/test-send`, payload);
  }

  // rules
  listRules(params?: { eventKey?: string; enabled?: boolean }) {
    let httpParams = new HttpParams();
    if (params?.eventKey) httpParams = httpParams.set('eventKey', params.eventKey);
    if (params?.enabled !== undefined) httpParams = httpParams.set('enabled', String(params.enabled));
    return this.http.get<NotificationRule[]>(`${this.base}/rules`, { params: httpParams });
  }
  createRule(payload: Partial<NotificationRule> & { name: string; eventKey: string; templateId: string; recipients: string[] }) {
    return this.http.post<NotificationRule>(`${this.base}/rules`, payload);
  }
  updateRule(id: string, payload: Partial<NotificationRule>) {
    return this.http.patch<NotificationRule>(`${this.base}/rules/${id}`, payload);
  }
  deleteRule(id: string) {
    return this.http.delete<NotificationRule>(`${this.base}/rules/${id}`);
  }

  // log
  log(params?: { eventKey?: string; status?: string; limit?: number }) {
    let httpParams = new HttpParams();
    if (params?.eventKey) httpParams = httpParams.set('eventKey', params.eventKey);
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.limit) httpParams = httpParams.set('limit', String(params.limit));
    return this.http.get<NotificationLogEntry[]>(`${this.base}/log`, { params: httpParams });
  }
}
