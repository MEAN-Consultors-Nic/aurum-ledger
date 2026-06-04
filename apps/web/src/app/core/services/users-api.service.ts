import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AdminUser } from '../models/admin-user.model';

@Injectable({ providedIn: 'root' })
export class UsersApiService {
  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<AdminUser[]>(`${environment.apiUrl}/users`);
  }

  create(payload: {
    name: string;
    username: string;
    email: string;
    password: string;
    role?: 'admin' | 'staff';
  }) {
    return this.http.post<AdminUser>(`${environment.apiUrl}/users`, payload);
  }

  update(id: string, payload: Partial<AdminUser> & { password?: string }) {
    return this.http.patch<AdminUser>(`${environment.apiUrl}/users/${id}`, payload);
  }

  toggleActive(id: string) {
    return this.http.patch<AdminUser>(`${environment.apiUrl}/users/${id}/toggle-active`, {});
  }
}
