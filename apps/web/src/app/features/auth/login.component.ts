import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div
      class="relative min-h-screen text-slate-900"
      style="background:
        radial-gradient(900px 600px at 0% 0%, rgba(214,226,239,.55), transparent 60%),
        radial-gradient(900px 600px at 100% 100%, rgba(172,194,218,.45), transparent 60%),
        #F7F9FC;"
    >
      <div class="relative z-10 flex min-h-screen items-center justify-center px-6 py-10">
        <div class="w-full max-w-sm">
          <!-- Brand mark -->
          <div class="mb-8 flex flex-col items-center text-center">
            <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-navy-700 text-white shadow-sm">
              <svg viewBox="0 0 24 24" class="h-6 w-6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M12 4v3M12 17v3M4 12h3M17 12h3M6.3 6.3l2.1 2.1M15.6 15.6l2.1 2.1M6.3 17.7l2.1-2.1M15.6 8.4l2.1-2.1"/>
              </svg>
            </div>
            <h1 class="mt-4 text-2xl font-semibold tracking-tight text-slate-900">Helm</h1>
            <p class="mt-1 text-sm text-slate-500">Financial ops platform for MEAN Consultors</p>
          </div>

          <!-- Card -->
          <div class="rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
            <form class="space-y-4" [formGroup]="form" (ngSubmit)="submit()">
              <div>
                <label class="text-xs font-medium text-slate-600">Email or username</label>
                <input
                  type="text"
                  formControlName="identifier"
                  autocomplete="username"
                  class="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 transition focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                  placeholder="you@meanconsultors.com"
                />
              </div>

              <div>
                <label class="text-xs font-medium text-slate-600">Password</label>
                <div class="relative mt-1.5">
                  <input
                    [type]="showPassword ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="current-password"
                    class="w-full rounded-md border border-slate-200 bg-white px-3 py-2 pr-10 text-sm text-slate-900 placeholder-slate-400 transition focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    (click)="showPassword = !showPassword"
                    [attr.aria-label]="showPassword ? 'Hide password' : 'Show password'"
                    [attr.aria-pressed]="showPassword"
                    tabindex="-1"
                    class="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400 transition hover:text-slate-700"
                  >
                    <svg *ngIf="!showPassword" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/>
                      <circle cx="12" cy="12" r="3"/>
                    </svg>
                    <svg *ngIf="showPassword" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19c-6.5 0-10-7-10-7a18.66 18.66 0 0 1 4.06-5.06"/>
                      <path d="M9.9 4.24A10.94 10.94 0 0 1 12 4c6.5 0 10 7 10 7a18.6 18.6 0 0 1-2.16 3.19"/>
                      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                      <line x1="2" y1="2" x2="22" y2="22"/>
                    </svg>
                  </button>
                </div>
              </div>

              <label class="flex cursor-pointer items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  formControlName="remember"
                  class="h-3.5 w-3.5 rounded border-slate-300 accent-navy-700"
                />
                Keep me signed in
              </label>

              <button
                type="submit"
                class="flex w-full items-center justify-center gap-2 rounded-md bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-navy-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                [disabled]="form.invalid || isLoading"
              >
                <svg *ngIf="isLoading" class="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
                  <path d="M22 12a10 10 0 0 1-10 10"/>
                </svg>
                {{ isLoading ? 'Signing in…' : 'Sign in' }}
              </button>

              <div
                *ngIf="error"
                class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700"
              >
                {{ error }}
              </div>
            </form>
          </div>

          <p class="mt-6 text-center text-[11px] text-slate-400">
            &copy; MEAN Consultors · {{ year }}
          </p>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  error = '';
  isLoading = false;
  showPassword = false;
  readonly year = new Date().getFullYear();
  form;

  constructor(
    private readonly fb: FormBuilder,
    private readonly authService: AuthService,
    private readonly router: Router,
  ) {
    this.form = this.fb.group({
      identifier: ['', [Validators.required]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      remember: [false],
    });
    this.loadRemembered();
  }

  submit() {
    if (this.form.invalid) {
      return;
    }

    this.error = '';
    this.isLoading = true;
    const { identifier, password, remember } = this.form.getRawValue();
    if (!remember) {
      this.clearRemembered();
    }

    this.authService.login(identifier ?? '', password ?? '').subscribe({
      next: () => {
        if (remember) {
          this.saveRemembered(identifier ?? '', password ?? '');
        }
        this.isLoading = false;
        this.router.navigate(['/dashboard']);
      },
      error: () => {
        this.isLoading = false;
        this.error = 'Invalid credentials';
      },
    });
  }

  private loadRemembered() {
    try {
      const raw = localStorage.getItem('rememberedLogin');
      if (!raw) {
        return;
      }
      const data = JSON.parse(raw) as { identifier?: string; email?: string; password?: string };
      const identifier = data?.identifier ?? data?.email ?? '';
      if (identifier && data?.password) {
        this.form.patchValue({ identifier, password: data.password, remember: true });
      }
    } catch {
      this.clearRemembered();
    }
  }

  private saveRemembered(identifier: string, password: string) {
    localStorage.setItem('rememberedLogin', JSON.stringify({ identifier, password }));
  }

  private clearRemembered() {
    localStorage.removeItem('rememberedLogin');
  }
}
