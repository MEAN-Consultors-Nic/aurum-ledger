import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  ProjectCredential,
  ProjectItem,
  ProjectStatus,
  ProjectTask,
  ProjectTemplateSummary,
} from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectsApiService {
  private readonly base = `${environment.apiUrl}/projects`;

  constructor(private readonly http: HttpClient) {}

  list(params?: { status?: ProjectStatus; clientId?: string; search?: string }) {
    let httpParams = new HttpParams();
    if (params?.status) httpParams = httpParams.set('status', params.status);
    if (params?.clientId) httpParams = httpParams.set('clientId', params.clientId);
    if (params?.search) httpParams = httpParams.set('search', params.search);
    return this.http.get<ProjectItem[]>(this.base, { params: httpParams });
  }

  findById(id: string) {
    return this.http.get<ProjectItem>(`${this.base}/${id}`);
  }

  create(payload: Partial<ProjectItem> & { contractId: string; clientId: string; name: string }) {
    return this.http.post<ProjectItem>(this.base, payload);
  }

  update(id: string, payload: Partial<ProjectItem>) {
    return this.http.patch<ProjectItem>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<ProjectItem>(`${this.base}/${id}`);
  }

  templates() {
    return this.http.get<ProjectTemplateSummary[]>(`${this.base}/templates`);
  }

  applyTemplate(id: string, templateKey: string) {
    return this.http.post<{ project: ProjectItem; addedTasks: number }>(
      `${this.base}/${id}/apply-template/${templateKey}`,
      {},
    );
  }

  // ----- Notes -----
  addNote(id: string, payload: { title: string; body: string }) {
    return this.http.post<ProjectItem>(`${this.base}/${id}/notes`, payload);
  }
  updateNote(id: string, noteId: string, payload: { title?: string; body?: string }) {
    return this.http.patch<ProjectItem>(`${this.base}/${id}/notes/${noteId}`, payload);
  }
  deleteNote(id: string, noteId: string) {
    return this.http.delete<ProjectItem>(`${this.base}/${id}/notes/${noteId}`);
  }

  // ----- Deliverables -----
  addDeliverable(id: string, payload: { label: string; note?: string }) {
    return this.http.post<ProjectItem>(`${this.base}/${id}/deliverables`, payload);
  }
  updateDeliverable(
    id: string,
    deliverableId: string,
    payload: { label?: string; done?: boolean; note?: string },
  ) {
    return this.http.patch<ProjectItem>(
      `${this.base}/${id}/deliverables/${deliverableId}`,
      payload,
    );
  }
  deleteDeliverable(id: string, deliverableId: string) {
    return this.http.delete<ProjectItem>(`${this.base}/${id}/deliverables/${deliverableId}`);
  }

  // ----- Tasks -----
  listTasks(id: string) {
    return this.http.get<ProjectTask[]>(`${this.base}/${id}/tasks`);
  }
  createTask(
    id: string,
    payload: Partial<ProjectTask> & { title: string },
  ) {
    return this.http.post<ProjectTask>(`${this.base}/${id}/tasks`, payload);
  }
  updateTask(id: string, taskId: string, payload: Partial<ProjectTask>) {
    return this.http.patch<ProjectTask>(`${this.base}/${id}/tasks/${taskId}`, payload);
  }
  deleteTask(id: string, taskId: string) {
    return this.http.delete<ProjectTask>(`${this.base}/${id}/tasks/${taskId}`);
  }

  // ----- Credentials -----
  listCredentials(id: string) {
    return this.http.get<ProjectCredential[]>(`${this.base}/${id}/credentials`);
  }
  createCredential(
    id: string,
    payload: { type: string; name: string; fields: Record<string, unknown>; notes?: string },
  ) {
    return this.http.post<ProjectCredential>(`${this.base}/${id}/credentials`, payload);
  }
  updateCredential(
    id: string,
    credentialId: string,
    payload: Partial<{ type: string; name: string; fields: Record<string, unknown>; notes?: string }>,
  ) {
    return this.http.patch<ProjectCredential>(
      `${this.base}/${id}/credentials/${credentialId}`,
      payload,
    );
  }
  deleteCredential(id: string, credentialId: string) {
    return this.http.delete<{ _id: string; deleted: boolean }>(
      `${this.base}/${id}/credentials/${credentialId}`,
    );
  }
}
