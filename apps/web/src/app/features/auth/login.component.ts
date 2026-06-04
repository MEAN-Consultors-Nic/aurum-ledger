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
    <div class="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 flex items-center justify-center px-6">
      <div class="w-full max-w-md bg-white/90 backdrop-blur rounded-2xl p-8 shadow-xl">
        <div class="text-2xl font-semibold text-slate-900">AurumLedger</div>
        <div class="text-sm text-slate-500">MEAN Consultors</div>

        <form class="mt-6 space-y-4" [formGroup]="form" (ngSubmit)="submit()">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
              Username or email
            </label>
            <input
              type="text"
              formControlName="identifier"
              class="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="username or user@domain.com"
            />
          </div>
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Password</label>
            <input
              type="password"
              formControlName="password"
              class="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              placeholder="********"
            />
          </div>
          <label class="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" formControlName="remember" class="h-4 w-4" />
            Remember me
          </label>

          <button
            type="submit"
            class="w-full rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-white"
            [disabled]="form.invalid || isLoading"
          >
            {{ isLoading ? 'Signing in...' : 'Sign in' }}
          </button>

          <div *ngIf="error" class="text-sm text-red-600">{{ error }}</div>
        </form>
      </div>
    </div>
  `,
})
export class LoginComponent {
  error = '';
  isLoading = false;
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
