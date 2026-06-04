import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { User } from '../models/user.model';

type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: User;
};

const ACCESS_TOKEN_KEY = 'aurum_access_token';
const REFRESH_TOKEN_KEY = 'aurum_refresh_token';
const USER_KEY = 'aurum_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly accessTokenSignal = signal<string | null>(
    localStorage.getItem(ACCESS_TOKEN_KEY),
  );
  private readonly refreshTokenSignal = signal<string | null>(
    localStorage.getItem(REFRESH_TOKEN_KEY),
  );
  private readonly userSignal = signal<User | null>(this.readStoredUser());

  readonly user = computed(() => this.userSignal());
  readonly isAuthenticated = computed(() => !!this.accessTokenSignal());

  constructor(private readonly http: HttpClient) {}

  login(identifier: string, password: string) {
    const observable = this.http.post<AuthResponse>(`${environment.apiUrl}/auth/login`, {
      identifier,
      password,
    });
    observable.subscribe({
      next: (response) => this.setSession(response),
    });
    // Workaround para conflicto de tipos RxJS en monorepo
    return observable as any;
  }

  refresh() {
    const refreshToken = this.refreshTokenSignal();
    if (!refreshToken) {
      return null;
    }

    const observable = this.http.post<AuthResponse>(`${environment.apiUrl}/auth/refresh`, { refreshToken });
    observable.subscribe({
      next: (response) => this.setSession(response),
    });
    // Workaround para conflicto de tipos RxJS en monorepo
    return observable as any;
  }

  logout() {
    const observable = this.http.post(`${environment.apiUrl}/auth/logout`, {});
    observable.subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession(),
    });
    // Workaround para conflicto de tipos RxJS en monorepo
    return observable as any;
  }

  getAccessToken() {
    return this.accessTokenSignal();
  }

  getRole() {
    return this.userSignal()?.role;
  }

  clearSession() {
    this.accessTokenSignal.set(null);
    this.refreshTokenSignal.set(null);
    this.userSignal.set(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }

  private setSession(response: AuthResponse) {
    this.accessTokenSignal.set(response.accessToken);
    this.refreshTokenSignal.set(response.refreshToken);
    this.userSignal.set(response.user);
    localStorage.setItem(ACCESS_TOKEN_KEY, response.accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, response.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  }

  private readStoredUser(): User | null {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
