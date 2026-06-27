import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ProjectsApiService } from '../../core/services/projects-api.service';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { ServicesApiService } from '../../core/services/services-api.service';
import { ProjectItem, ProjectStatus, ProjectTemplateSummary } from '../../core/models/project.model';
import { ClientItem } from '../../core/models/client.model';
import { ServiceItem } from '../../core/models/service.model';
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
            Operational hub — tasks, notes, credentials, deliverables. Standalone or linked to a contract.
          </div>
        </div>
        <button
          type="button"
          (click)="openCreate()"
          class="self-start rounded-md bg-navy-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-navy-800 md:self-auto"
        >
          + New project
        </button>
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
          No projects yet.
          <button
            type="button"
            (click)="openCreate()"
            class="ml-1 font-medium text-navy-700 hover:underline"
          >Create your first one</button>
          — or activate a contract to spin one up automatically.
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

      <!-- New project modal -->
      <div *ngIf="modalOpen" class="fixed inset-0 z-40 bg-slate-900/30" (click)="closeModal()"></div>
      <div *ngIf="modalOpen" class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:p-8">
        <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-xl">
          <header class="flex items-center justify-between border-b border-slate-200 px-5 py-3">
            <h2 class="text-base font-semibold text-slate-900">New project</h2>
            <button type="button" (click)="closeModal()" class="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </header>
          <form class="space-y-3 px-5 py-4" (ngSubmit)="submitCreate()">
            <div>
              <label class="text-[11px] font-medium text-slate-600">Project name *</label>
              <input
                type="text"
                [(ngModel)]="form.name"
                name="name"
                required
                placeholder="e.g. ACME Corp — Website refresh"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              />
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Client *</label>
              <select
                [(ngModel)]="form.clientId"
                name="clientId"
                required
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              >
                <option value="">— Select client —</option>
                <option *ngFor="let c of clients" [value]="c._id">{{ c.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Service</label>
              <select
                [(ngModel)]="form.serviceId"
                name="serviceId"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              >
                <option value="">— None —</option>
                <option *ngFor="let s of services" [value]="s._id">{{ s.name }}</option>
              </select>
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Template</label>
              <select
                [(ngModel)]="form.templateKey"
                name="templateKey"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              >
                <option value="">— Blank (no tasks / deliverables) —</option>
                <option *ngFor="let t of templates" [value]="t.key">
                  {{ t.label }} ({{ t.taskCount }} tasks · {{ t.deliverableCount }} deliverables)
                </option>
              </select>
              <p class="mt-1 text-[10px] text-slate-400">Pre-loads tasks and deliverables you can edit later.</p>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="text-[11px] font-medium text-slate-600">Start date</label>
                <input
                  type="date"
                  [(ngModel)]="form.startDate"
                  name="startDate"
                  class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                />
              </div>
              <div>
                <label class="text-[11px] font-medium text-slate-600">Due date</label>
                <input
                  type="date"
                  [(ngModel)]="form.dueDate"
                  name="dueDate"
                  class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                />
              </div>
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Description</label>
              <textarea
                [(ngModel)]="form.description"
                name="description"
                rows="2"
                placeholder="Scope, references, etc."
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              ></textarea>
            </div>

            <div *ngIf="createError" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">{{ createError }}</div>

            <div class="flex items-center justify-end gap-2 pt-2">
              <button type="button" (click)="closeModal()" class="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">Cancel</button>
              <button
                type="submit"
                [disabled]="isCreating"
                class="rounded-md bg-navy-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:bg-slate-300"
              >{{ isCreating ? 'Creating…' : 'Create project' }}</button>
            </div>
          </form>
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

  modalOpen = false;
  isCreating = false;
  createError = '';
  clients: ClientItem[] = [];
  services: ServiceItem[] = [];
  templates: ProjectTemplateSummary[] = [];

  form: {
    name: string;
    clientId: string;
    serviceId: string;
    templateKey: string;
    startDate: string;
    dueDate: string;
    description: string;
  } = {
    name: '',
    clientId: '',
    serviceId: '',
    templateKey: '',
    startDate: '',
    dueDate: '',
    description: '',
  };

  constructor(
    private readonly projectsApi: ProjectsApiService,
    private readonly clientsApi: ClientsApiService,
    private readonly servicesApi: ServicesApiService,
    private readonly confirmDialog: ConfirmService,
    private readonly router: Router,
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

  openCreate() {
    this.form = {
      name: '',
      clientId: '',
      serviceId: '',
      templateKey: '',
      startDate: '',
      dueDate: '',
      description: '',
    };
    this.createError = '';
    this.modalOpen = true;
    if (this.clients.length === 0) {
      this.clientsApi.list({ limit: 200, isActive: true }).subscribe({
        next: (res) => (this.clients = res.items ?? []),
      });
    }
    if (this.services.length === 0) {
      this.servicesApi.list().subscribe({
        next: (items) => (this.services = items ?? []),
      });
    }
    if (this.templates.length === 0) {
      this.projectsApi.templates().subscribe({
        next: (items) => (this.templates = items ?? []),
      });
    }
  }

  closeModal() {
    this.modalOpen = false;
  }

  submitCreate() {
    if (!this.form.name.trim() || !this.form.clientId) {
      this.createError = 'Name and client are required';
      return;
    }
    this.isCreating = true;
    this.createError = '';
    this.projectsApi
      .create({
        name: this.form.name.trim(),
        clientId: this.form.clientId,
        serviceId: this.form.serviceId || undefined,
        templateKey: this.form.templateKey || undefined,
        startDate: this.form.startDate || undefined,
        dueDate: this.form.dueDate || undefined,
        description: this.form.description || undefined,
      })
      .subscribe({
        next: (project) => {
          this.isCreating = false;
          this.modalOpen = false;
          this.router.navigate(['/projects', project._id]);
        },
        error: (err) => {
          this.isCreating = false;
          const message = Array.isArray(err?.error?.message)
            ? err.error.message.join(', ')
            : err?.error?.message;
          this.createError = message || 'Could not create project';
        },
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
