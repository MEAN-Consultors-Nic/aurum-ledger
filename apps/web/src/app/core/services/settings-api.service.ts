import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { SettingItem } from '../models/setting.model';

@Injectable({ providedIn: 'root' })
export class SettingsApiService {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<SettingItem[]>(`${environment.apiUrl}/settings`);
  }

  update(key: string, value: string) {
    return this.http.put<SettingItem>(`${environment.apiUrl}/settings/${key}`, { value });
  }
}
