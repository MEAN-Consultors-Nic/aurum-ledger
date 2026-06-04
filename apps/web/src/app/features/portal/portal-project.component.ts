import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { PublicApiService, PublicProject } from '../../core/services/public-api.service';

@Component({
  selector: 'app-portal-project',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-50 text-slate-900">
      <!-- Brand header -->
      <header class="border-b border-slate-200 bg-white">
        <div class="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div class="text-lg font-semibold tracking-tight">MEAN Consultors</div>
          <div class="text-[10px] font-semibold uppercase tracking-[0.25em] text-slate-400">
            Project portal
          </div>
        </div>
      </header>

      <main class="mx-auto max-w-5xl px-6 py-10">
        <!-- Loading -->
        <div *ngIf="isLoading" class="rounded-xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
          Loading project status…
        </div>

        <!-- Error -->
        <div *ngIf="error" class="rounded-xl border border-rose-200 bg-rose-50 px-6 py-10 text-center">
          <div class="text-base font-semibold text-rose-800">Link unavailable</div>
          <div class="mt-1 text-sm text-rose-700">{{ error }}</div>
        </div>

        <!-- Project content -->
        <article *ngIf="project" class="space-y-6">
          <!-- HERO -->
          <section class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div class="border-b border-slate-100 px-8 py-6">
              <div class="flex items-start justify-between gap-4">
                <div>
                  <div class="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-400">Project status</div>
                  <h1 class="mt-1 text-2xl font-semibold text-slate-900">{{ project.name }}</h1>
                  <div class="mt-1 text-sm text-slate-500">
                    For <span class="font-medium text-slate-700">{{ project.clientName || 'client' }}</span>
                    <span *ngIf="project.serviceName"> · {{ project.serviceName }}</span>
                  </div>
                </div>
                <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide"
                  [ngClass]="projectStatusClass(project.status)">
                  {{ projectStatusLabel(project.status) }}
                </span>
              </div>

              <!-- Progress -->
              <div class="mt-6">
                <div class="flex items-baseline justify-between">
                  <span class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Overall progress</span>
                  <span class="text-sm font-semibold text-slate-900">{{ project.progress }}%</span>
                </div>
                <div class="mt-1.5 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full bg-emerald-500 transition-all" [style.width.%]="project.progress"></div>
                </div>
              </div>

              <dl class="mt-6 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Start</dt>
                  <dd class="mt-1 text-sm text-slate-800">{{ formatDate(project.startDate) }}</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Target completion</dt>
                  <dd class="mt-1 text-sm text-slate-800">{{ formatDate(project.dueDate) }}</dd>
                </div>
                <div>
                  <dt class="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-400">Contract</dt>
                  <dd class="mt-1 text-sm text-slate-800">{{ project.contractTitle || '—' }}</dd>
                </div>
              </dl>
            </div>

            <div *ngIf="project.description" class="border-t border-slate-100 px-8 py-5">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">About this project</div>
              <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ project.description }}</p>
            </div>
          </section>

          <!-- Deliverables -->
          <section *ngIf="project.deliverables.length > 0" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header class="flex items-center justify-between border-b border-slate-100 px-8 py-4">
              <h2 class="text-sm font-semibold text-slate-900">Deliverables</h2>
              <span class="text-xs text-slate-500">
                {{ doneDeliverables() }} / {{ project.deliverables.length }} complete
              </span>
            </header>
            <ul class="divide-y divide-slate-100">
              <li *ngFor="let d of project.deliverables" class="flex items-center gap-3 px-8 py-3">
                <span class="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold"
                  [ngClass]="d.done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'">
                  {{ d.done ? '✓' : '·' }}
                </span>
                <span class="flex-1 text-sm" [ngClass]="d.done ? 'text-slate-500 line-through' : 'text-slate-900'">
                  {{ d.label }}
                </span>
                <span *ngIf="d.done && d.doneAt" class="text-[10px] uppercase tracking-wide text-slate-400">
                  {{ formatShortDate(d.doneAt) }}
                </span>
              </li>
            </ul>
          </section>

          <!-- Task summary -->
          <section *ngIf="project.tasks.length > 0" class="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <header class="border-b border-slate-100 px-8 py-4">
              <h2 class="text-sm font-semibold text-slate-900">Tasks at a glance</h2>
            </header>
            <div class="grid gap-3 px-8 py-5 sm:grid-cols-4">
              <div *ngFor="let s of taskStatusOrder" class="rounded-lg border border-slate-200 p-3">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {{ taskStatusLabel(s) }}
                </div>
                <div class="mt-1 text-xl font-semibold text-slate-900">{{ countByStatus(s) }}</div>
              </div>
            </div>
          </section>
        </article>

        <div class="mt-6 text-center text-[10px] uppercase tracking-[0.25em] text-slate-400">
          MEAN Consultors · Nicaragua
        </div>
      </main>
    </div>
  `,
})
export class PortalProjectComponent implements OnInit {
  project: PublicProject | null = null;
  isLoading = true;
  error = '';
  readonly taskStatusOrder: Array<'todo' | 'in_progress' | 'blocked' | 'done'> = [
    'todo',
    'in_progress',
    'blocked',
    'done',
  ];

  constructor(
    private readonly route: ActivatedRoute,
    private readonly publicApi: PublicApiService,
  ) {}

  ngOnInit() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    if (!token) {
      this.error = 'This link is invalid.';
      this.isLoading = false;
      return;
    }
    this.publicApi.getProject(token).subscribe({
      next: (p) => {
        this.project = p;
        this.isLoading = false;
      },
      error: () => {
        this.error = 'This link is no longer valid or has been revoked.';
        this.isLoading = false;
      },
    });
  }

  doneDeliverables(): number {
    return this.project ? this.project.deliverables.filter((d) => d.done).length : 0;
  }

  countByStatus(status: 'todo' | 'in_progress' | 'blocked' | 'done'): number {
    if (!this.project) return 0;
    return this.project.tasks.filter((t) => t.status === status).length;
  }

  projectStatusClass(s: string) {
    switch (s) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700';
      case 'on_hold':
        return 'bg-amber-100 text-amber-700';
      case 'completed':
        return 'bg-indigo-100 text-indigo-700';
      case 'archived':
        return 'bg-slate-100 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  projectStatusLabel(s: string) {
    if (s === 'on_hold') return 'On hold';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  taskStatusLabel(s: string) {
    if (s === 'in_progress') return 'In progress';
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  formatDate(value?: string | null) {
    if (!value) return '—';
    return new Date(value).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  formatShortDate(value?: string | null) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
