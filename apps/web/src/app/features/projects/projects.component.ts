import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ProjectsApiService } from '../../core/services/projects-api.service';
import { ProjectItem, ProjectStatus } from '../../core/models/project.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ActionMenuComponent],
  template: `
    <div class="space-y-6">
      <header class="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold text-slate-900">Projects</div>
          <div class="text-sm text-slate-500">
            Operational hub for contracts in flight — tasks, notes, credentials, deliverables.
          </div>
        </div>
      </header>

      <div class="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:flex-row">
        <input
          type="text"
          [(ngModel)]="search"
          (keyup.enter)="load()"
          placeholder="Search by name…"
          class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <select
          [(ngModel)]="statusFilter"
          (change)="load()"
          class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="on_hold">On hold</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <button
          (click)="load()"
          class="rounded bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
        >
          Filter
        </button>
      </div>

      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div *ngIf="isLoading" class="px-5 py-10 text-center text-sm text-slate-500">
          Loading projects…
        </div>
        <div
          *ngIf="!isLoading && projects.length === 0"
          class="px-5 py-12 text-center text-sm text-slate-500"
        >
          No projects yet. They're created automatically when you activate a contract.
        </div>

        <div *ngIf="!isLoading && projects.length > 0" class="divide-y divide-slate-100">
          <a
            *ngFor="let project of projects"
            [routerLink]="['/projects', project._id]"
            class="block px-5 py-4 transition hover:bg-slate-50"
          >
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="truncate text-base font-semibold text-slate-900">{{ project.name }}</span>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                    [ngClass]="statusBadge(project.status)"
                  >
                    {{ statusLabel(project.status) }}
                  </span>
                </div>
                <div class="mt-1 text-xs text-slate-500">
                  {{ clientName(project) }}<span *ngIf="serviceName(project)"> · {{ serviceName(project) }}</span>
                </div>
                <div *ngIf="project.dueDate" class="mt-1 text-xs text-slate-500">
                  Due {{ formatDate(project.dueDate) }}
                </div>
              </div>
              <div class="hidden flex-col items-end gap-1 md:flex">
                <div class="text-xs text-slate-500">
                  {{ project.taskDone || 0 }} / {{ project.taskTotal || 0 }} tasks
                </div>
                <div class="h-1.5 w-32 overflow-hidden rounded-full bg-slate-100">
                  <div
                    class="h-full bg-emerald-500 transition-all"
                    [style.width.%]="taskProgress(project)"
                  ></div>
                </div>
              </div>
              <div (click)="$event.preventDefault(); $event.stopPropagation()">
                <app-action-menu [items]="rowActions(project)" />
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  `,
})
export class ProjectsComponent implements OnInit {
  projects: ProjectItem[] = [];
  search = '';
  statusFilter: '' | ProjectStatus = '';
  isLoading = false;

  constructor(
    private readonly projectsApi: ProjectsApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.projectsApi
      .list({
        search: this.search || undefined,
        status: this.statusFilter || undefined,
      })
      .subscribe({
        next: (items) => {
          this.projects = items;
          this.isLoading = false;
        },
        error: () => (this.isLoading = false),
      });
  }

  rowActions(project: ProjectItem): ActionMenuItem[] {
    return [
      {
        label: 'Mark as on hold',
        action: () => this.changeStatus(project, 'on_hold'),
        disabled: project.status === 'on_hold',
      },
      {
        label: 'Mark as completed',
        action: () => this.changeStatus(project, 'completed'),
        disabled: project.status === 'completed',
      },
      {
        label: 'Archive',
        action: () => this.changeStatus(project, 'archived'),
        disabled: project.status === 'archived',
      },
      {
        label: 'Delete',
        action: () => this.remove(project),
        danger: true,
      },
    ];
  }

  changeStatus(project: ProjectItem, status: ProjectStatus) {
    this.projectsApi.update(project._id, { status }).subscribe({
      next: () => this.load(),
    });
  }

  async remove(project: ProjectItem) {
    const confirmed = await this.confirmDialog.open({
      title: 'Delete project',
      message: `Delete project "${project.name}"? This cannot be undone.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    this.projectsApi.remove(project._id).subscribe({ next: () => this.load() });
  }

  // --- helpers ---
  clientName(project: ProjectItem) {
    if (typeof project.clientId === 'string') return '—';
    return project.clientId?.name ?? '—';
  }

  serviceName(project: ProjectItem) {
    if (!project.serviceId) return '';
    if (typeof project.serviceId === 'string') return '';
    return project.serviceId?.name ?? '';
  }

  taskProgress(project: ProjectItem) {
    if (!project.taskTotal) return 0;
    return Math.round(((project.taskDone || 0) / project.taskTotal) * 100);
  }

  statusBadge(status: ProjectStatus) {
    switch (status) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700';
      case 'on_hold':
        return 'bg-amber-50 text-amber-700';
      case 'completed':
        return 'bg-sky-50 text-sky-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  }

  statusLabel(status: ProjectStatus) {
    if (status === 'on_hold') return 'On hold';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  formatDate(date?: string) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }
}
