import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ClientsApiService } from '../../core/services/clients-api.service';
import { ConfirmService } from '../../core/services/confirm.service';
import { EstimatesApiService } from '../../core/services/estimates-api.service';
import { ServicesApiService } from '../../core/services/services-api.service';
import { ClientItem } from '../../core/models/client.model';
import { EstimateItem } from '../../core/models/estimate.model';
import { ServiceItem } from '../../core/models/service.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import {
  SendNotificationDialogComponent,
  SendNotificationConfig,
} from '../../shared/send-notification-dialog/send-notification-dialog.component';

type EstimateStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired' | 'converted';

@Component({
  selector: 'app-estimate-editor',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ActionMenuComponent,
    SendNotificationDialogComponent,
  ],
  template: `
    <div *ngIf="isLoading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Loading estimate…
    </div>

    <div *ngIf="!isLoading && loadError" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {{ loadError }}
    </div>

    <div *ngIf="!isLoading && !loadError" class="flex h-[calc(100vh-7rem)] flex-col">
      <!-- HEADER -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <a routerLink="/estimates" class="hover:text-slate-900">Estimates</a>
            <span>›</span>
            <span class="text-slate-900">{{ isNew ? 'New' : (form.value.title || 'Untitled') }}</span>
          </div>
          <div class="mt-1 flex items-center gap-2">
            <div class="text-xl font-semibold text-slate-900">
              {{ isNew ? 'New estimate' : (form.value.title || 'Estimate') }}
            </div>
            <span
              class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              [ngClass]="statusBadge(form.value.status)"
            >
              {{ statusLabel(form.value.status) }}
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <select
            [ngModel]="form.value.status"
            (ngModelChange)="form.patchValue({ status: $event })"
            class="rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase tracking-wide text-slate-700"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
            <option value="expired">Expired</option>
          </select>
          <button
            type="button"
            [disabled]="isNew || !canSend()"
            (click)="openSendDialog('estimate.sent', 'Send estimate to client')"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-40"
          >
            Send to client
          </button>
          <app-action-menu *ngIf="!isNew" [items]="moreActions()" />
          <a
            routerLink="/estimates"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Cancel
          </a>
          <button
            type="button"
            [disabled]="isSaving || form.invalid"
            (click)="save()"
            class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
          >
            {{ isSaving ? 'Saving…' : (isNew ? 'Create estimate' : 'Save changes') }}
          </button>
        </div>
      </header>

      <div *ngIf="validationError" class="border-b border-rose-100 bg-rose-50 px-6 py-2 text-xs text-rose-700">
        {{ validationError }}
      </div>
      <div *ngIf="saveBanner" class="border-b border-emerald-100 bg-emerald-50 px-6 py-2 text-xs text-emerald-700">
        {{ saveBanner }}
      </div>

      <!-- BODY -->
      <div class="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_minmax(0,640px)]">
        <!-- LEFT: FORM -->
        <section class="overflow-y-auto px-6 py-6" [formGroup]="form">
          <div class="mx-auto max-w-3xl space-y-6">

            <!-- Basic info -->
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="text-sm font-semibold text-slate-900">Basic info</div>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Client</label>
                  <select formControlName="clientId" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">— Select client —</option>
                    <option *ngFor="let c of clients" [value]="c._id">{{ c.name }}</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Service</label>
                  <select formControlName="serviceId" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">— Select service —</option>
                    <option *ngFor="let s of services" [value]="s._id">{{ s.name }}</option>
                  </select>
                </div>
              </div>
              <div class="mt-4">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Title</label>
                <input
                  formControlName="title"
                  placeholder="e.g. Hosting CAMAY 2026"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <!-- Pricing -->
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="text-sm font-semibold text-slate-900">Pricing & validity</div>
              <div class="mt-4 grid gap-4 sm:grid-cols-4">
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Period</label>
                  <select formControlName="billingPeriod" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="monthly">Monthly</option>
                    <option value="annual">Annual</option>
                    <option value="one_time">One-time</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Amount</label>
                  <input formControlName="amount" type="number" step="0.01" min="0"
                    class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Currency</label>
                  <select formControlName="currency" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="USD">USD</option>
                    <option value="NIO">NIO</option>
                  </select>
                </div>
                <div>
                  <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Valid until</label>
                  <input formControlName="validUntil" type="date" class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </div>
              <div class="mt-2 text-[11px] text-slate-500">
                After the validity date the estimate is considered expired.
              </div>
            </div>

            <!-- Scope -->
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-semibold text-slate-900">Scope of work</div>
                  <div class="text-xs text-slate-500">What's included in this proposal.</div>
                </div>
              </div>
              <textarea
                formControlName="scope"
                rows="6"
                placeholder="Describe the work, exclusions, methodology…"
                class="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              ></textarea>
            </div>

            <!-- Deliverables -->
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="flex items-center justify-between">
                <div>
                  <div class="text-sm font-semibold text-slate-900">Deliverables</div>
                  <div class="text-xs text-slate-500">Concrete items the client will receive.</div>
                </div>
                <button type="button" class="rounded border border-slate-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-700"
                  (click)="addDeliverable()">
                  + Add
                </button>
              </div>

              <div *ngIf="deliverables.length === 0" class="mt-3 rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-500">
                No deliverables yet — e.g. "Live website on production", "Admin training session", "30-day post-launch support".
              </div>

              <ul class="mt-3 space-y-2">
                <li *ngFor="let d of deliverables; let i = index; trackBy: trackByIndex" class="flex items-center gap-2">
                  <span class="text-[11px] font-mono text-slate-400 w-6 text-right">{{ i + 1 }}.</span>
                  <input
                    [(ngModel)]="deliverables[i]"
                    [ngModelOptions]="{ standalone: true }"
                    placeholder="e.g. Domain configured + SSL"
                    class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                  />
                  <div class="flex items-center gap-1">
                    <button type="button" [disabled]="i === 0" (click)="moveDeliverable(i, -1)"
                      class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-30">↑</button>
                    <button type="button" [disabled]="i === deliverables.length - 1" (click)="moveDeliverable(i, 1)"
                      class="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 disabled:opacity-30">↓</button>
                    <button type="button" (click)="removeDeliverable(i)"
                      class="rounded border border-rose-200 px-2 py-1 text-xs text-rose-700 hover:bg-rose-50">×</button>
                  </div>
                </li>
              </ul>
            </div>

            <!-- Terms -->
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="text-sm font-semibold text-slate-900">Terms & conditions</div>
              <div class="text-xs text-slate-500">Payment terms, retainer, refund policy, IP ownership…</div>
              <textarea
                formControlName="terms"
                rows="5"
                class="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              ></textarea>
            </div>

            <!-- Internal notes -->
            <div class="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div class="text-sm font-semibold text-slate-900">Internal notes</div>
              <div class="text-xs text-slate-500">Only visible to your team — never sent to the client.</div>
              <textarea
                formControlName="notes"
                rows="3"
                class="mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              ></textarea>
            </div>

            <!-- Bottom spacer -->
            <div class="h-12"></div>
          </div>
        </section>

        <!-- RIGHT: PREVIEW -->
        <aside class="flex flex-col overflow-hidden border-l border-slate-200 bg-slate-100">
          <div class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-600">Client preview</div>
            <div class="text-[10px] uppercase tracking-wide text-slate-400">As the client will see it</div>
          </div>
          <div class="flex-1 overflow-y-auto p-6">
            <div class="mx-auto max-w-xl rounded-2xl bg-white p-7 shadow-md">
              <div class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Estimate</div>
              <div class="mt-1 text-2xl font-semibold text-slate-900">
                {{ form.value.title || 'Untitled' }}
              </div>
              <div class="mt-1 text-sm text-slate-500">
                Prepared for <span class="font-medium text-slate-900">{{ previewClientName() }}</span>
              </div>

              <div class="mt-5 rounded-xl bg-slate-50 p-4">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Service</div>
                <div class="text-sm font-medium text-slate-900">{{ previewServiceName() }}</div>
                <div class="mt-2 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <div class="text-[10px] uppercase tracking-wide text-slate-500">Billing</div>
                    <div class="text-slate-900">{{ billingLabel(form.value.billingPeriod) }}</div>
                  </div>
                  <div>
                    <div class="text-[10px] uppercase tracking-wide text-slate-500">Valid until</div>
                    <div class="text-slate-900">{{ formatDate(form.value.validUntil) || '—' }}</div>
                  </div>
                </div>
                <div class="mt-4 text-3xl font-bold text-slate-900">
                  {{ form.value.currency || 'USD' }} {{ formatAmount(form.value.amount) }}
                </div>
              </div>

              <ng-container *ngIf="form.value.scope">
                <div class="mt-6">
                  <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Scope of work</div>
                  <div class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{{ form.value.scope }}</div>
                </div>
              </ng-container>

              <ng-container *ngIf="hasNonEmptyDeliverable()">
                <div class="mt-6">
                  <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Deliverables</div>
                  <ul class="mt-2 space-y-1.5 text-sm text-slate-700">
                    <li *ngFor="let d of nonEmptyDeliverables()" class="flex gap-2">
                      <span class="text-emerald-600">✓</span>
                      <span>{{ d }}</span>
                    </li>
                  </ul>
                </div>
              </ng-container>

              <ng-container *ngIf="form.value.terms">
                <div class="mt-6">
                  <div class="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Terms</div>
                  <div class="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-slate-600">{{ form.value.terms }}</div>
                </div>
              </ng-container>

              <div class="mt-8 border-t border-slate-100 pt-4 text-xs text-slate-400">
                MEAN Consultors · this preview shows how the estimate will look when sent to the client.
              </div>
            </div>

            <div *ngIf="form.value.notes" class="mx-auto mt-4 max-w-xl rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-amber-700">Internal notes</div>
              <div class="mt-1 whitespace-pre-wrap text-xs text-amber-900">{{ form.value.notes }}</div>
              <div class="mt-1 text-[10px] text-amber-600">Visible only to your team. Not part of the client email.</div>
            </div>
          </div>
        </aside>
      </div>
    </div>

    <!-- Send notification dialog -->
    <app-send-notification-dialog
      [open]="isSendNotifOpen"
      [config]="sendNotifConfig"
      (closed)="closeSendDialog()"
    ></app-send-notification-dialog>
  `,
})
export class EstimateEditorComponent implements OnInit {
  estimateId: string | null = null;
  isNew = true;
  isLoading = false;
  isSaving = false;
  loadError = '';
  validationError = '';
  saveBanner = '';

  form: FormGroup;
  deliverables: string[] = [];

  clients: ClientItem[] = [];
  services: ServiceItem[] = [];

  // Send notification dialog
  isSendNotifOpen = false;
  sendNotifConfig: SendNotificationConfig | null = null;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly fb: FormBuilder,
    private readonly estimatesApi: EstimatesApiService,
    private readonly clientsApi: ClientsApiService,
    private readonly servicesApi: ServicesApiService,
    private readonly confirmDialog: ConfirmService,
  ) {
    this.form = this.fb.group({
      clientId: ['', Validators.required],
      serviceId: ['', Validators.required],
      title: [''],
      billingPeriod: ['monthly', Validators.required],
      amount: [0, [Validators.required, Validators.min(0)]],
      currency: ['USD', Validators.required],
      status: ['draft', Validators.required],
      scope: [''],
      terms: [''],
      validUntil: [''],
      notes: [''],
    });
  }

  ngOnInit() {
    const idParam = this.route.snapshot.params['id'];
    this.estimateId = idParam && idParam !== 'new' ? idParam : null;
    this.isNew = !this.estimateId;
    this.isLoading = true;

    forkJoin({
      clients: this.clientsApi.list({ isActive: true, limit: 500 }),
      services: this.servicesApi.list(),
      estimate: this.estimateId
        ? this.estimatesApi.list({ search: undefined, limit: 1 }).pipe(catchError(() => of({ items: [] } as any)))
        : of(null),
    }).subscribe({
      next: ({ clients, services }) => {
        this.clients = clients.items;
        this.services = services.filter((s) => s.isActive);
        if (this.estimateId) {
          this.loadEstimate(this.estimateId);
        } else {
          this.isLoading = false;
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.loadError = err?.error?.message ?? 'Unable to load editor';
      },
    });
  }

  private loadEstimate(id: string) {
    this.estimatesApi.findById(id).subscribe({
      next: (item) => {
        this.applyEstimate(item);
        this.isLoading = false;
      },
      error: (err) => {
        this.loadError = err?.error?.message ?? 'Unable to load estimate';
        this.isLoading = false;
      },
    });
  }

  private applyEstimate(item: EstimateItem) {
    this.deliverables = [...(item.deliverables ?? [])];
    this.form.reset({
      clientId: this.resolveId(item.clientId),
      serviceId: this.resolveId(item.serviceId),
      title: item.title ?? '',
      billingPeriod: item.billingPeriod,
      amount: item.amount,
      currency: item.currency,
      status: item.status === 'converted' ? 'accepted' : item.status,
      scope: item.scope ?? '',
      terms: item.terms ?? '',
      validUntil: this.toDateInput(item.validUntil),
      notes: item.notes ?? '',
    });
    if (item.status === 'converted') {
      this.form.disable();
      this.validationError = 'This estimate has been converted to a contract and is read-only.';
    }
  }

  save() {
    if (this.form.invalid) {
      this.validationError = 'Complete the required fields (client, service, period, amount).';
      return;
    }
    this.isSaving = true;
    this.validationError = '';
    this.saveBanner = '';
    const cleanDeliverables = this.deliverables
      .map((d) => (d ?? '').trim())
      .filter((d) => d.length > 0);
    const payload = {
      clientId: this.form.value.clientId ?? '',
      serviceId: this.form.value.serviceId ?? '',
      title: this.form.value.title || undefined,
      billingPeriod: this.form.value.billingPeriod ?? 'monthly',
      amount: Number(this.form.value.amount ?? 0),
      currency: this.form.value.currency ?? 'USD',
      status: this.form.value.status ?? 'draft',
      notes: this.form.value.notes || undefined,
      scope: this.form.value.scope || undefined,
      terms: this.form.value.terms || undefined,
      validUntil: this.form.value.validUntil || undefined,
      deliverables: cleanDeliverables,
    };

    if (this.estimateId) {
      this.estimatesApi.update(this.estimateId, payload).subscribe({
        next: () => {
          this.isSaving = false;
          this.saveBanner = 'Estimate saved.';
          setTimeout(() => (this.saveBanner = ''), 2500);
        },
        error: (err) => {
          this.isSaving = false;
          this.validationError = err?.error?.message ?? 'Unable to save estimate';
        },
      });
    } else {
      this.estimatesApi.create(payload).subscribe({
        next: (created) => {
          this.isSaving = false;
          this.router.navigate(['/estimates', created._id]);
        },
        error: (err) => {
          this.isSaving = false;
          this.validationError = err?.error?.message ?? 'Unable to create estimate';
        },
      });
    }
  }

  // ---- deliverables ----
  addDeliverable() {
    this.deliverables = [...this.deliverables, ''];
  }
  removeDeliverable(i: number) {
    this.deliverables = this.deliverables.filter((_, idx) => idx !== i);
  }
  moveDeliverable(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= this.deliverables.length) return;
    const arr = [...this.deliverables];
    [arr[i], arr[j]] = [arr[j], arr[i]];
    this.deliverables = arr;
  }
  trackByIndex(i: number) {
    return i;
  }

  // ---- actions ----
  moreActions(): ActionMenuItem[] {
    const items: ActionMenuItem[] = [];
    const status = this.form.value.status as EstimateStatus;
    if (status === 'sent') {
      items.push({
        label: 'Send reminder',
        action: () => this.openSendDialog('estimate.reminder', 'Send estimate reminder'),
      });
    }
    if (!this.isNew && status !== 'converted' && status !== 'rejected' && status !== 'expired') {
      items.push({
        label: 'Convert to contract',
        action: () => this.goToConvertFromList(),
      });
    }
    items.push({
      label: 'Delete estimate',
      action: () => this.remove(),
      danger: true,
      disabled: status === 'converted',
    });
    return items;
  }

  goToConvertFromList() {
    // Convert UX lives in the list view; navigate back so the user can use it.
    this.router.navigate(['/estimates'], { queryParams: { convert: this.estimateId } });
  }

  remove() {
    if (!this.estimateId) return;
    this.estimatesApi.remove(this.estimateId).subscribe({
      next: () => this.router.navigate(['/estimates']),
      error: (err) => {
        this.validationError = err?.error?.message ?? 'Unable to delete estimate';
      },
    });
  }

  canSend(): boolean {
    const status = this.form.value.status as EstimateStatus;
    return status !== 'converted' && status !== 'rejected';
  }

  openSendDialog(eventKey: string, title: string) {
    if (!this.estimateId) return;
    const subtitle = `${this.previewClientName()} · ${this.form.value.title || 'estimate'} · ${this.form.value.currency} ${this.formatAmount(this.form.value.amount)}`;
    this.sendNotifConfig = {
      title,
      subtitle,
      eventKey,
      contextType: 'estimate',
      contextId: this.estimateId,
      defaultRecipients: ['contract.client'],
      recipientSuggestions: [
        { label: 'Client', expression: 'contract.client', description: 'Email on file for the client' },
        { label: 'All admins', expression: 'admin', description: 'Active admin users' },
      ],
    };
    this.isSendNotifOpen = true;
  }
  closeSendDialog() {
    this.isSendNotifOpen = false;
    this.sendNotifConfig = null;
  }

  // ---- helpers ----
  resolveId(value: unknown): string {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (typeof value === 'object' && value && '_id' in value) return (value as { _id: string })._id;
    return '';
  }
  toDateInput(date?: string) {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  previewClientName() {
    const id = this.form.value.clientId;
    if (!id) return 'the client';
    return this.clients.find((c) => c._id === id)?.name ?? 'the client';
  }
  previewServiceName() {
    const id = this.form.value.serviceId;
    if (!id) return '—';
    return this.services.find((s) => s._id === id)?.name ?? '—';
  }
  hasNonEmptyDeliverable() {
    return this.deliverables.some((d) => (d ?? '').trim().length > 0);
  }
  nonEmptyDeliverables() {
    return this.deliverables.map((d) => (d ?? '').trim()).filter((d) => d.length > 0);
  }
  billingLabel(period?: string) {
    if (period === 'monthly') return 'Monthly';
    if (period === 'annual') return 'Annual';
    if (period === 'one_time') return 'One-time';
    return '—';
  }
  formatAmount(value: number | string | null | undefined): string {
    const n = Number(value ?? 0);
    return n.toFixed(2);
  }
  formatDate(d?: string) {
    if (!d) return '';
    const date = new Date(d);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  statusLabel(status?: string) {
    if (!status) return 'Draft';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }
  statusBadge(status?: string) {
    switch (status) {
      case 'sent':
        return 'bg-sky-50 text-sky-700';
      case 'accepted':
        return 'bg-emerald-50 text-emerald-700';
      case 'rejected':
        return 'bg-rose-50 text-rose-700';
      case 'expired':
        return 'bg-slate-100 text-slate-500';
      case 'converted':
        return 'bg-indigo-50 text-indigo-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }
}
