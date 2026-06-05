import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { ContractsApiService } from '../../core/services/contracts-api.service';
import { EstimatesApiService } from '../../core/services/estimates-api.service';
import { PaymentsApiService } from '../../core/services/payments-api.service';
import { ProjectsApiService } from '../../core/services/projects-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { ClientItem } from '../../core/models/client.model';
import { ContractItem } from '../../core/models/contract.model';
import { EstimateItem } from '../../core/models/estimate.model';
import { PaymentItem } from '../../core/models/payment.model';
import { ProjectItem } from '../../core/models/project.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import { AttachmentsPanelComponent } from '../../shared/attachments-panel/attachments-panel.component';
import { CustomFieldsPanelComponent } from '../../shared/custom-fields-panel/custom-fields-panel.component';

type Tab = 'overview' | 'contracts' | 'estimates' | 'projects' | 'payments' | 'attachments';

type ClientWithCustom = ClientItem & { customValues?: Record<string, unknown> };

@Component({
  selector: 'app-client-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    ActionMenuComponent,
    AttachmentsPanelComponent,
    CustomFieldsPanelComponent,
  ],
  template: `
    <div *ngIf="isLoading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Loading client…
    </div>

    <div *ngIf="!isLoading && error" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {{ error }}
    </div>

    <div *ngIf="!isLoading && client" class="space-y-6">
      <!-- Header -->
      <header class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <a routerLink="/clients" class="text-xs uppercase tracking-wide text-slate-500 hover:text-slate-900">
              ← All clients
            </a>
            <div class="mt-2 flex items-center gap-3">
              <h1 class="text-2xl font-semibold text-slate-900">{{ client.name }}</h1>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="client.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'">
                {{ client.isActive ? 'Active' : 'Inactive' }}
              </span>
              <span *ngFor="let t of (client.tags ?? [])"
                class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                {{ t }}
              </span>
            </div>
            <div class="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-500">
              <span *ngIf="client.contactName">{{ client.contactName }}</span>
              <a *ngIf="client.email" [href]="'mailto:' + client.email"
                class="text-slate-700 hover:underline">{{ client.email }}</a>
              <span *ngIf="client.phone">{{ client.phone }}</span>
            </div>
          </div>
          <app-action-menu [items]="headerActions()" />
        </div>
      </header>

      <!-- KPI strip -->
      <section *ngIf="summary" class="grid gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Contracts</div>
          <div class="mt-1 text-2xl font-semibold text-slate-900">{{ summary.totalContratos }}</div>
        </div>
        <div class="rounded-xl border p-4 shadow-sm"
          [ngClass]="summary.totalAdeudado > 0 ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Outstanding</div>
          <div class="mt-1 text-2xl font-semibold"
            [ngClass]="summary.totalAdeudado > 0 ? 'text-amber-700' : 'text-slate-400'">
            {{ formatAmount(summary.totalAdeudado) }}
          </div>
        </div>
        <div class="rounded-xl border p-4 shadow-sm"
          [ngClass]="summary.vencidos > 0 ? 'border-rose-200 bg-rose-50' : 'border-slate-200 bg-white'">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Overdue</div>
          <div class="mt-1 text-2xl font-semibold"
            [ngClass]="summary.vencidos > 0 ? 'text-rose-700' : 'text-slate-400'">
            {{ summary.vencidos }}
          </div>
        </div>
        <div class="rounded-xl border p-4 shadow-sm border-slate-200 bg-white">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Due in 30d</div>
          <div class="mt-1 text-2xl font-semibold text-slate-900">{{ summary.proximosAVencer }}</div>
        </div>
      </section>

      <!-- Tabs -->
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3">
          <button *ngFor="let tab of tabs"
            (click)="activeTab = tab.key"
            class="rounded-t-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
            [ngClass]="activeTab === tab.key
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'"
          >
            {{ tab.label }}
            <span *ngIf="tab.count !== undefined" class="ml-1 opacity-70">({{ tab.count }})</span>
          </button>
        </div>

        <!-- Overview -->
        <div *ngIf="activeTab === 'overview'" class="space-y-6 p-6">
          <!-- Basic information -->
          <div class="rounded-lg border border-slate-200 p-4">
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Basic information
              </div>
              <span *ngIf="basicSaveBanner"
                class="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">
                {{ basicSaveBanner }}
              </span>
            </div>
            <div class="mt-3 grid gap-3 sm:grid-cols-2">
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Name</label>
                <input
                  [(ngModel)]="basic.name"
                  (blur)="saveBasic('name')"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Contact name</label>
                <input
                  [(ngModel)]="basic.contactName"
                  (blur)="saveBasic('contactName')"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Email</label>
                <input
                  type="email"
                  [(ngModel)]="basic.email"
                  (blur)="saveBasic('email')"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Phone</label>
                <input
                  [(ngModel)]="basic.phone"
                  (blur)="saveBasic('phone')"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div class="sm:col-span-2">
                <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Tags <span class="text-slate-400">(comma-separated)</span>
                </label>
                <input
                  [(ngModel)]="basic.tagsText"
                  (blur)="saveBasic('tags')"
                  placeholder="VIP, hosting, support"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <label class="sm:col-span-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <input type="checkbox" [(ngModel)]="basic.isActive" (change)="saveBasic('isActive')" />
                <span class="text-sm text-slate-700">Active client</span>
              </label>
            </div>
            <div *ngIf="basicError" class="mt-2 text-xs text-rose-600">{{ basicError }}</div>
          </div>

          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</div>
            <textarea
              [(ngModel)]="notesDraft"
              (blur)="saveNotes()"
              rows="4"
              placeholder="Internal notes about this client…"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div>
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom fields</div>
              <span *ngIf="customSaveBanner"
                class="text-[10px] font-semibold uppercase tracking-wide"
                [ngClass]="customSaveBanner === 'Saving…' ? 'text-slate-500' : 'text-emerald-600'">
                {{ customSaveBanner }}
              </span>
            </div>
            <div class="mt-2">
              <app-custom-fields-panel
                entityType="client"
                [values]="customValues"
                (valuesChange)="onCustomValuesChange($event)"
                [showEmptyHint]="true"
              />
            </div>
            <div *ngIf="customError" class="mt-2 text-xs text-rose-600">{{ customError }}</div>
          </div>

          <!-- Recent contracts preview -->
          <div *ngIf="contracts.length > 0">
            <div class="flex items-center justify-between">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Recent contracts</div>
              <button (click)="activeTab = 'contracts'"
                class="text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-900">
                See all →
              </button>
            </div>
            <ul class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              <li *ngFor="let c of contracts.slice(0, 3)" class="flex items-center gap-3 px-3 py-2">
                <span class="flex-1 truncate text-sm font-medium text-slate-800">{{ c.title || 'Untitled' }}</span>
                <span class="text-[11px] text-slate-500">{{ c.billingPeriod }}</span>
                <span class="text-sm font-semibold tabular-nums text-slate-900">
                  {{ c.currency }} {{ formatAmount(c.amount) }}
                </span>
                <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                  [ngClass]="contractStatusClass(c.status)">{{ c.status }}</span>
              </li>
            </ul>
          </div>
        </div>

        <!-- Contracts -->
        <div *ngIf="activeTab === 'contracts'" class="p-6">
          <div *ngIf="contracts.length === 0" class="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No contracts with this client yet.
          </div>
          <table *ngIf="contracts.length > 0" class="w-full text-sm">
            <thead class="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr class="border-b border-slate-100">
                <th class="py-2 font-semibold">Title</th>
                <th class="py-2 font-semibold">Billing</th>
                <th class="py-2 text-right font-semibold">Amount</th>
                <th class="py-2 text-right font-semibold">Paid</th>
                <th class="py-2 text-right font-semibold">Balance</th>
                <th class="py-2 font-semibold">Status</th>
                <th class="py-2 font-semibold">End</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of contracts" class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td class="py-2 font-medium text-slate-900">{{ c.title || 'Untitled' }}</td>
                <td class="py-2 text-slate-600">{{ c.billingPeriod }}</td>
                <td class="py-2 text-right tabular-nums text-slate-900">{{ c.currency }} {{ formatAmount(c.amount) }}</td>
                <td class="py-2 text-right tabular-nums text-emerald-700">{{ formatAmount(c.paidTotal ?? 0) }}</td>
                <td class="py-2 text-right tabular-nums"
                  [ngClass]="((c.amount ?? 0) - (c.paidTotal ?? 0)) > 0 ? 'text-rose-700' : 'text-slate-400'">
                  {{ formatAmount((c.amount ?? 0) - (c.paidTotal ?? 0)) }}
                </td>
                <td class="py-2">
                  <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                    [ngClass]="contractStatusClass(c.status)">{{ c.status }}</span>
                </td>
                <td class="py-2 text-slate-600">{{ formatDate(c.endDate) }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Estimates -->
        <div *ngIf="activeTab === 'estimates'" class="p-6">
          <div *ngIf="estimates.length === 0" class="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No estimates for this client yet.
          </div>
          <ul *ngIf="estimates.length > 0" class="divide-y divide-slate-100 rounded-lg border border-slate-200">
            <li *ngFor="let e of estimates"
              [routerLink]="['/estimates', e._id]"
              class="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
              <span class="flex-1 truncate text-sm font-medium text-slate-900">{{ e.title || 'Untitled estimate' }}</span>
              <span class="text-[11px] text-slate-500">{{ e.billingPeriod }}</span>
              <span class="text-sm font-semibold tabular-nums">{{ e.currency }} {{ formatAmount(e.amount) }}</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="estimateStatusClass(e.status)">{{ e.status }}</span>
            </li>
          </ul>
        </div>

        <!-- Projects -->
        <div *ngIf="activeTab === 'projects'" class="p-6">
          <div *ngIf="projects.length === 0" class="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No projects for this client yet.
          </div>
          <ul *ngIf="projects.length > 0" class="divide-y divide-slate-100 rounded-lg border border-slate-200">
            <li *ngFor="let p of projects"
              [routerLink]="['/projects', p._id]"
              class="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-slate-50">
              <span class="flex-1 truncate text-sm font-medium text-slate-900">{{ p.name }}</span>
              <span *ngIf="p.dueDate" class="text-[11px] text-slate-500">Due {{ formatDate(p.dueDate) }}</span>
              <span class="text-[11px] text-slate-500">{{ (p.taskDone ?? 0) }}/{{ (p.taskTotal ?? 0) }} tasks</span>
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="projectStatusClass(p.status)">{{ p.status }}</span>
            </li>
          </ul>
        </div>

        <!-- Payments -->
        <div *ngIf="activeTab === 'payments'" class="p-6">
          <div *ngIf="payments.length === 0" class="rounded-lg bg-slate-50 px-3 py-6 text-center text-sm text-slate-500">
            No payments recorded for this client yet.
          </div>
          <table *ngIf="payments.length > 0" class="w-full text-sm">
            <thead class="text-left text-[10px] uppercase tracking-wider text-slate-500">
              <tr class="border-b border-slate-100">
                <th class="py-2 font-semibold">Date</th>
                <th class="py-2 font-semibold">Method</th>
                <th class="py-2 text-right font-semibold">Amount</th>
                <th class="py-2 font-semibold">Currency</th>
                <th class="py-2 font-semibold">Reference</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let p of payments" class="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td class="py-2 text-slate-600">{{ formatDate(p.paymentDate) }}</td>
                <td class="py-2 text-slate-600">{{ p.method }}</td>
                <td class="py-2 text-right tabular-nums text-emerald-700">{{ formatAmount(p.amount) }}</td>
                <td class="py-2 text-slate-600">{{ p.currency }}</td>
                <td class="py-2 text-slate-500">{{ p.reference || '—' }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Attachments -->
        <div *ngIf="activeTab === 'attachments'" class="p-4">
          <app-attachments-panel parentType="client" [parentId]="clientId" />
        </div>
      </div>
    </div>
  `,
})
export class ClientDetailComponent implements OnInit {
  clientId = '';
  client: ClientWithCustom | null = null;
  summary: { totalContratos: number; totalAdeudado: number; vencidos: number; proximosAVencer: number } | null = null;
  contracts: ContractItem[] = [];
  estimates: EstimateItem[] = [];
  projects: ProjectItem[] = [];
  payments: PaymentItem[] = [];

  isLoading = false;
  error = '';

  activeTab: Tab = 'overview';
  notesDraft = '';
  customValues: Record<string, unknown> = {};
  customSaveBanner = '';
  customError = '';
  private customValuesDirty = false;
  private customValuesTimer: ReturnType<typeof setTimeout> | null = null;
  private customBannerTimer: ReturnType<typeof setTimeout> | null = null;

  // Inline-edit drafts for basic info
  basic = {
    name: '',
    contactName: '',
    email: '',
    phone: '',
    tagsText: '',
    isActive: true,
  };
  basicSaveBanner = '';
  basicError = '';
  private basicBannerTimer: ReturnType<typeof setTimeout> | null = null;

  get tabs(): { key: Tab; label: string; count?: number }[] {
    return [
      { key: 'overview', label: 'Overview' },
      { key: 'contracts', label: 'Contracts', count: this.contracts.length },
      { key: 'estimates', label: 'Estimates', count: this.estimates.length },
      { key: 'projects', label: 'Projects', count: this.projects.length },
      { key: 'payments', label: 'Payments', count: this.payments.length },
      { key: 'attachments', label: 'Attachments' },
    ];
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly clientsApi: ClientsApiService,
    private readonly contractsApi: ContractsApiService,
    private readonly estimatesApi: EstimatesApiService,
    private readonly projectsApi: ProjectsApiService,
    private readonly paymentsApi: PaymentsApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    this.clientId = this.route.snapshot.params['id'];
    this.loadAll();
  }

  loadAll() {
    this.isLoading = true;
    this.error = '';
    forkJoin({
      client: this.clientsApi.findById(this.clientId).pipe(catchError(() => of(null))),
      summary: this.clientsApi.summary(this.clientId).pipe(catchError(() => of(null))),
      contracts: this.contractsApi
        .list({ clientId: this.clientId, limit: 100 })
        .pipe(catchError(() => of({ items: [] as ContractItem[] }))),
      estimates: this.estimatesApi
        .list({ clientId: this.clientId, limit: 100 })
        .pipe(catchError(() => of({ items: [] as EstimateItem[] }))),
      projects: this.projectsApi
        .list({ clientId: this.clientId })
        .pipe(catchError(() => of([] as ProjectItem[]))),
      payments: this.paymentsApi
        .list({ clientId: this.clientId, limit: 100 })
        .pipe(catchError(() => of({ items: [] as PaymentItem[] }))),
    }).subscribe({
      next: ({ client, summary, contracts, estimates, projects, payments }) => {
        if (!client) {
          this.error = 'Client not found';
          this.isLoading = false;
          return;
        }
        this.client = client as ClientWithCustom;
        this.summary = summary;
        this.contracts = contracts.items ?? [];
        this.estimates = estimates.items ?? [];
        this.projects = Array.isArray(projects) ? projects : (projects as any).items ?? [];
        this.payments = payments.items ?? [];
        this.notesDraft = this.client.notes ?? '';
        this.customValues = { ...(this.client.customValues ?? {}) };
        this.basic = {
          name: this.client.name ?? '',
          contactName: this.client.contactName ?? '',
          email: this.client.email ?? '',
          phone: this.client.phone ?? '',
          tagsText: (this.client.tags ?? []).join(', '),
          isActive: !!this.client.isActive,
        };
        this.isLoading = false;
      },
      error: () => {
        this.error = 'Unable to load client';
        this.isLoading = false;
      },
    });
  }

  headerActions(): ActionMenuItem[] {
    if (!this.client) return [];
    const c = this.client;
    return [
      {
        label: c.isActive ? 'Deactivate' : 'Activate',
        action: () => this.toggleStatus(),
      },
      { label: 'Refresh', action: () => this.loadAll() },
      { label: 'Delete', action: () => this.remove(), danger: true },
    ];
  }

  toggleStatus() {
    if (!this.client) return;
    const next = !this.client.isActive;
    this.clientsApi.update(this.client._id, { isActive: next }).subscribe({
      next: () => {
        if (this.client) this.client.isActive = next;
        this.basic.isActive = next;
      },
    });
  }

  async remove() {
    if (!this.client) return;
    const ok = await this.confirmDialog.open({
      title: 'Delete client',
      message: `Delete "${this.client.name}"? Linked contracts and projects keep working but the client is hidden.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.clientsApi.remove(this.client._id).subscribe({
      next: () => this.router.navigate(['/clients']),
    });
  }

  saveBasic(field: 'name' | 'contactName' | 'email' | 'phone' | 'tags' | 'isActive') {
    if (!this.client) return;
    const payload: Partial<ClientItem> & { tags?: string[] } = {};
    if (field === 'name') {
      const next = this.basic.name.trim();
      if (next === this.client.name) return;
      if (next.length < 2) {
        this.basicError = 'Name must be at least 2 characters';
        this.basic.name = this.client.name;
        return;
      }
      payload.name = next;
    } else if (field === 'contactName') {
      if ((this.basic.contactName ?? '') === (this.client.contactName ?? '')) return;
      payload.contactName = this.basic.contactName.trim() || undefined;
    } else if (field === 'email') {
      if ((this.basic.email ?? '') === (this.client.email ?? '')) return;
      payload.email = this.basic.email.trim() || undefined;
    } else if (field === 'phone') {
      if ((this.basic.phone ?? '') === (this.client.phone ?? '')) return;
      payload.phone = this.basic.phone.trim() || undefined;
    } else if (field === 'tags') {
      const nextTags = this.basic.tagsText
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);
      const currentTags = (this.client.tags ?? []).join(',');
      if (nextTags.join(',') === currentTags) return;
      payload.tags = nextTags;
    } else if (field === 'isActive') {
      if (this.basic.isActive === this.client.isActive) return;
      payload.isActive = this.basic.isActive;
    }

    this.basicError = '';
    this.clientsApi.update(this.client._id, payload as never).subscribe({
      next: (updated) => {
        if (!this.client) return;
        this.client = { ...this.client, ...updated };
        this.flashBasicSaved();
      },
      error: (err) => {
        this.basicError = err?.error?.message ?? 'Unable to save change';
      },
    });
  }

  private flashBasicSaved() {
    this.basicSaveBanner = 'Saved';
    if (this.basicBannerTimer) clearTimeout(this.basicBannerTimer);
    this.basicBannerTimer = setTimeout(() => (this.basicSaveBanner = ''), 1500);
  }

  saveNotes() {
    if (!this.client) return;
    if (this.notesDraft === (this.client.notes ?? '')) return;
    this.clientsApi.update(this.client._id, { notes: this.notesDraft }).subscribe({
      next: () => {
        if (this.client) this.client.notes = this.notesDraft;
      },
    });
  }

  onCustomValuesChange(values: Record<string, unknown>) {
    this.customValues = values;
    this.customValuesDirty = true;
    this.customError = '';
    this.customSaveBanner = 'Saving…';
    if (this.customValuesTimer) clearTimeout(this.customValuesTimer);
    this.customValuesTimer = setTimeout(() => this.persistCustomValues(), 700);
  }

  private persistCustomValues() {
    if (!this.client || !this.customValuesDirty) return;
    this.customValuesDirty = false;
    this.clientsApi
      .update(this.client._id, { customValues: this.customValues } as never)
      .subscribe({
        next: () => {
          this.customSaveBanner = 'Saved';
          if (this.customBannerTimer) clearTimeout(this.customBannerTimer);
          this.customBannerTimer = setTimeout(() => (this.customSaveBanner = ''), 1500);
        },
        error: (err) => {
          this.customSaveBanner = '';
          this.customError = err?.error?.message ?? 'Unable to save custom fields';
        },
      });
  }

  // ----- visual helpers -----

  contractStatusClass(status: string): string {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'expired') return 'bg-amber-100 text-amber-700';
    if (status === 'cancelled') return 'bg-rose-100 text-rose-700';
    return 'bg-slate-100 text-slate-700';
  }

  estimateStatusClass(status: string): string {
    if (status === 'sent') return 'bg-blue-100 text-blue-700';
    if (status === 'accepted') return 'bg-emerald-100 text-emerald-700';
    if (status === 'rejected') return 'bg-rose-100 text-rose-700';
    if (status === 'expired') return 'bg-amber-100 text-amber-700';
    if (status === 'converted') return 'bg-indigo-100 text-indigo-700';
    return 'bg-slate-100 text-slate-700';
  }

  projectStatusClass(status: string): string {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    if (status === 'on_hold') return 'bg-amber-100 text-amber-700';
    if (status === 'completed') return 'bg-indigo-100 text-indigo-700';
    return 'bg-slate-100 text-slate-700';
  }

  formatAmount(value: number | undefined): string {
    return Number(value ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  formatDate(value?: string | Date | null): string {
    if (!value) return '—';
    return new Date(value as string).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }
}
