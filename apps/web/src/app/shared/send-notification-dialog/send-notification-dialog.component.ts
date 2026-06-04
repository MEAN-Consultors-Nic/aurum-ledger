import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NotificationsEngineApiService } from '../../core/services/notifications-engine-api.service';
import { NotificationTemplate } from '../../core/models/notification-engine.model';

export type SendNotificationConfig = {
  title: string;
  subtitle?: string;
  eventKey: string;
  contextType: 'contract' | 'project' | 'client';
  contextId: string;
  defaultRecipients: string[];      // expressions e.g. 'contract.client', 'custom:foo@x.com'
  recipientSuggestions?: {
    label: string;
    expression: string;
    description?: string;
  }[];
};

@Component({
  selector: 'app-send-notification-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      *ngIf="open && config"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <header class="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div class="text-lg font-semibold text-slate-900">{{ config.title }}</div>
            <div *ngIf="config.subtitle" class="mt-1 text-sm text-slate-500">{{ config.subtitle }}</div>
          </div>
          <button class="text-slate-400" (click)="close()">×</button>
        </header>

        <div class="space-y-4 overflow-y-auto px-6 py-5">
          <!-- Template selector -->
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Template</label>
            <select
              [(ngModel)]="selectedTemplateId"
              (ngModelChange)="updatePreview()"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option [ngValue]="''" disabled>— Select template —</option>
              <option *ngFor="let t of availableTemplates" [ngValue]="t._id">
                {{ t.name }}<span *ngIf="t.isSystem"> (system)</span>
              </option>
            </select>
            <div *ngIf="availableTemplates.length === 0" class="mt-2 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
              No templates exist for this event yet. Create one in
              <a routerLink="/notification-center" class="underline">Notification Center</a> and try again.
            </div>
          </div>

          <!-- Recipients -->
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Recipients</label>
            <div class="mt-1 space-y-1.5">
              <label
                *ngFor="let s of config.recipientSuggestions"
                class="flex items-start gap-2 text-sm text-slate-700"
              >
                <input
                  type="checkbox"
                  class="mt-0.5"
                  [checked]="hasRecipient(s.expression)"
                  (change)="toggleRecipient(s.expression, $any($event.target).checked)"
                />
                <div>
                  <div>{{ s.label }}</div>
                  <div *ngIf="s.description" class="text-[11px] text-slate-500">{{ s.description }}</div>
                </div>
              </label>
              <div class="flex items-center gap-2 pt-1">
                <input
                  [(ngModel)]="customEmail"
                  placeholder="another@email.com"
                  class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  class="rounded border border-slate-200 px-3 py-1.5 text-xs uppercase tracking-wide text-slate-700"
                  (click)="addCustomRecipient()"
                >
                  + Add
                </button>
              </div>
              <div *ngFor="let r of customRecipients()" class="flex items-center gap-2 text-xs">
                <span class="font-mono text-slate-700">{{ r.replace('custom:', '') }}</span>
                <button class="text-rose-600" (click)="removeRecipient(r)">remove</button>
              </div>
            </div>
          </div>

          <!-- Preview -->
          <div *ngIf="preview">
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Preview (with real data)</label>
            <div class="mt-2 overflow-hidden rounded-lg border border-slate-200 bg-white">
              <div class="border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                <span class="text-slate-500">Subject:</span>
                <span class="ml-1 font-semibold text-slate-900">{{ preview.subject }}</span>
              </div>
              <iframe
                [srcdoc]="preview.html"
                sandbox=""
                class="w-full"
                style="height: 320px;"
              ></iframe>
            </div>
          </div>

          <div *ngIf="error" class="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{{ error }}</div>
        </div>

        <footer class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
          <div *ngIf="result" class="text-xs"
            [ngClass]="result.sent > 0 && result.failed === 0 ? 'text-emerald-700' : 'text-rose-700'">
            <span *ngIf="result.sent > 0">✓ Sent to {{ result.sent }} recipient{{ result.sent === 1 ? '' : 's' }}</span>
            <span *ngIf="result.failed > 0"> · {{ result.failed }} failed</span>
          </div>
          <div *ngIf="!result"></div>
          <div class="flex gap-2">
            <button
              class="rounded border border-slate-200 px-4 py-2 text-xs uppercase tracking-wide text-slate-700"
              (click)="close()"
            >
              Cancel
            </button>
            <button
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-40"
              [disabled]="isSending || !selectedTemplateId || selectedRecipients.length === 0"
              (click)="send()"
            >
              {{ isSending ? 'Sending…' : 'Send now' }}
            </button>
          </div>
        </footer>
      </div>
    </div>
  `,
})
export class SendNotificationDialogComponent implements OnChanges {
  @Input() open = false;
  @Input() config: SendNotificationConfig | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() sent = new EventEmitter<{ sent: number; failed: number }>();

  availableTemplates: NotificationTemplate[] = [];
  selectedTemplateId = '';
  selectedRecipients: string[] = [];
  customEmail = '';
  preview: { subject: string; html: string; text: string } | null = null;
  isSending = false;
  error = '';
  result: { sent: number; failed: number } | null = null;

  constructor(private readonly api: NotificationsEngineApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (!this.open || !this.config) return;
    if (changes['open']?.currentValue || changes['config']?.currentValue) {
      this.reset();
      this.loadTemplates();
    }
  }

  private reset() {
    this.selectedTemplateId = '';
    this.selectedRecipients = [...(this.config?.defaultRecipients ?? [])];
    this.customEmail = '';
    this.preview = null;
    this.error = '';
    this.result = null;
  }

  private loadTemplates() {
    if (!this.config) return;
    this.api.listTemplates({ eventKey: this.config.eventKey }).subscribe({
      next: (items) => {
        this.availableTemplates = items.filter((t) => t.isActive);
        if (this.availableTemplates.length > 0 && !this.selectedTemplateId) {
          this.selectedTemplateId = this.availableTemplates[0]._id;
          this.updatePreview();
        }
      },
    });
  }

  hasRecipient(expression: string) {
    return this.selectedRecipients.includes(expression);
  }
  toggleRecipient(expression: string, checked: boolean) {
    if (checked) {
      if (!this.selectedRecipients.includes(expression)) this.selectedRecipients.push(expression);
    } else {
      this.selectedRecipients = this.selectedRecipients.filter((r) => r !== expression);
    }
  }
  customRecipients() {
    return this.selectedRecipients.filter((r) => r.startsWith('custom:'));
  }
  addCustomRecipient() {
    const email = (this.customEmail || '').trim();
    if (!email) return;
    const expr = `custom:${email}`;
    if (!this.selectedRecipients.includes(expr)) this.selectedRecipients.push(expr);
    this.customEmail = '';
  }
  removeRecipient(r: string) {
    this.selectedRecipients = this.selectedRecipients.filter((x) => x !== r);
  }

  updatePreview() {
    const tpl = this.availableTemplates.find((t) => t._id === this.selectedTemplateId);
    if (!tpl) {
      this.preview = null;
      return;
    }
    this.api
      .preview({
        subject: tpl.subject,
        bodyHtml: tpl.bodyHtml,
        bodyText: tpl.bodyText,
        eventKey: tpl.eventKey,
      })
      .subscribe({
        next: (p) => (this.preview = p),
        error: () => (this.preview = null),
      });
  }

  send() {
    if (!this.config || !this.selectedTemplateId || this.selectedRecipients.length === 0) return;
    this.isSending = true;
    this.error = '';
    this.api
      .manualSend({
        templateId: this.selectedTemplateId,
        contextType: this.config.contextType,
        contextId: this.config.contextId,
        recipients: this.selectedRecipients,
      })
      .subscribe({
        next: (res) => {
          this.isSending = false;
          this.result = { sent: res.sent, failed: res.failed };
          if (res.failed === 0) {
            this.sent.emit(this.result);
            setTimeout(() => this.close(), 900);
          } else {
            this.error = res.results.find((r) => !r.ok)?.error ?? 'Some recipients failed';
          }
        },
        error: (err) => {
          this.isSending = false;
          this.error = err?.error?.message ?? 'Unable to send';
        },
      });
  }

  close() {
    this.open = false;
    this.closed.emit();
  }
}
