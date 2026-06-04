import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SettingItem } from '../models/setting.model';

export type GithubSettings = {
  org: string;
  autoCreate: boolean;
  defaultPrivate: boolean;
  hasToken: boolean;
};

export type UpdateGithubSettingsPayload = {
  org?: string;
  token?: string | null;
  autoCreate?: boolean;
  defaultPrivate?: boolean;
};

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<SettingItem[]>(`${environment.apiUrl}/settings`);
  }

  update(key: string, value: string) {
    return this.http.put<SettingItem>(`${environment.apiUrl}/settings/${key}`, { value });
  }

  // ----- GitHub -----
  getGithub() {
    return this.http.get<GithubSettings>(`${environment.apiUrl}/settings/github`);
  }

  updateGithub(payload: UpdateGithubSettingsPayload) {
    return this.http.put<GithubSettings>(`${environment.apiUrl}/settings/github`, payload);
  }
}
