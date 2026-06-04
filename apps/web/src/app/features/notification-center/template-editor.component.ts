import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationsEngineApiService } from '../../core/services/notifications-engine-api.service';
import {
  EventDefinition,
  NotificationTemplate,
  RenderPreview,
  TemplateGroup,
} from '../../core/models/notification-engine.model';

type Viewport = 'desktop' | 'mobile' | 'source';

@Component({
  selector: 'app-template-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="flex h-[calc(100vh-7rem)] flex-col">
      <!-- HEADER -->
      <header class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-6 py-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 text-xs uppercase tracking-wide text-slate-500">
            <a routerLink="/notification-center" class="hover:text-slate-900">Notification Center</a>
            <span>›</span>
            <span>Templates</span>
            <span>›</span>
            <span class="text-slate-900">{{ isNew ? 'New' : 'Edit' }}</span>
          </div>
          <div class="mt-1 text-xl font-semibold text-slate-900">
            {{ isNew ? 'New template' : (form.name || 'Untitled template') }}
            <span *ngIf="isSystem" class="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700">
              system
            </span>
          </div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <label class="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" [(ngModel)]="form.isActive" />
            Active
          </label>
          <input
            type="email"
            [(ngModel)]="testEmail"
            placeholder="your@email.com"
            class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="button"
            [disabled]="isNew || !testEmail || isSendingTest"
            (click)="sendTest()"
            class="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-40"
          >
            {{ isSendingTest ? 'Sending…' : 'Send test' }}
          </button>
          <a
            routerLink="/notification-center"
            class="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700"
          >
            Cancel
          </a>
          <button
            type="button"
            [disabled]="isSaving"
            (click)="save()"
            class="rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
          >
            {{ isSaving ? 'Saving…' : 'Save template' }}
          </button>
        </div>
      </header>

      <div *ngIf="testResult" class="border-b border-slate-200 px-6 py-2 text-xs"
        [ngClass]="testResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'">
        <span *ngIf="testResult.ok">✓ Test email sent</span>
        <span *ngIf="!testResult.ok">✗ {{ testResult.reason }}</span>
      </div>

      <!-- MAIN LAYOUT -->
      <div class="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)_minmax(0,560px)]">

        <!-- LEFT: SETTINGS + PLACEHOLDERS -->
        <aside class="overflow-y-auto border-r border-slate-200 bg-slate-50 p-5 lg:block">
          <div class="space-y-4">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
              <input
                [(ngModel)]="form.name"
                placeholder="Template name"
                class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Group</label>
              <select
                [(ngModel)]="form.groupId"
                class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option [ngValue]="''">— None —</option>
                <option *ngFor="let g of groups" [ngValue]="g._id">{{ g.name }}</option>
              </select>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Triggered by event</label>
              <select
                [(ngModel)]="form.eventKey"
                (ngModelChange)="onEventChange()"
                class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              >
                <option [ngValue]="''">— Generic / no event —</option>
                <option *ngFor="let e of events" [ngValue]="e.key">{{ e.label }}</option>
              </select>
              <div *ngIf="selectedEvent" class="mt-1.5 text-[11px] text-slate-500">
                {{ selectedEvent.description }}
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Description (internal)</label>
              <input
                [(ngModel)]="form.description"
                class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
              />
            </div>

            <!-- Placeholders -->
            <div class="border-t border-slate-200 pt-4">
              <div class="flex items-center justify-between">
                <div class="text-xs font-semibold uppercase tracking-wide text-slate-600">Placeholders</div>
                <span class="text-[10px] text-slate-400">click to insert</span>
              </div>
              <div *ngIf="placeholdersForEditor().length === 0" class="mt-3 text-xs text-slate-500">
                Choose an event to see its available placeholders, or use any of the Handlebars helpers below.
              </div>
              <div *ngIf="placeholdersForEditor().length > 0" class="mt-3 space-y-1.5">
                <button
                  *ngFor="let ph of placeholdersForEditor()"
                  type="button"
                  [title]="ph.description"
                  (click)="insertPlaceholder('{{ ' + ph.path + ' }}')"
                  class="block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left font-mono text-[11px] text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                >
                  <div class="font-semibold">{{ '{{' }}{{ ph.path }}{{ '}}' }}</div>
                  <div class="font-sans text-[10px] text-slate-500">{{ ph.description }}</div>
                </button>
              </div>

              <div class="mt-5 border-t border-slate-200 pt-3">
                <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Helpers</div>
                <div class="mt-2 space-y-1.5">
                  <button
                    type="button"
                    (click)="insertPlaceholder('{{ money contract.amount contract.currency }}')"
                    class="block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left font-mono text-[11px] text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                  >
                    money amount currency
                  </button>
                  <button
                    type="button"
                    (click)="insertPlaceholder('{{ date contract.endDate }}')"
                    class="block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left font-mono text-[11px] text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                  >
                    date value
                  </button>
                  <button
                    type="button"
                    (click)="insertPlaceholder('{{ uppercase client.name }}')"
                    class="block w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-left font-mono text-[11px] text-slate-700 hover:border-slate-400 hover:bg-slate-100"
                  >
                    uppercase value
                  </button>
                </div>
              </div>
            </div>
          </div>
        </aside>

        <!-- CENTER: EDITOR -->
        <section class="flex flex-col overflow-y-auto">
          <div class="px-6 py-5 space-y-4">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Subject</label>
              <input
                #subjectInput
                [(ngModel)]="form.subject"
                (focus)="lastFocusedField = 'subject'"
                placeholder="e.g. {{ '{{client.name}}' }} contract expires soon"
                class="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm"
              />
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Body (HTML)</label>
                <span class="text-[10px] text-slate-400">{{ form.bodyHtml.length }} chars</span>
              </div>
              <textarea
                #bodyInput
                [(ngModel)]="form.bodyHtml"
                (focus)="lastFocusedField = 'body'"
                rows="24"
                spellcheck="false"
                class="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[12px] leading-relaxed text-slate-900"
              ></textarea>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Text fallback (optional)</label>
              <textarea
                [(ngModel)]="form.bodyText"
                rows="4"
                spellcheck="false"
                class="mt-1 w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2.5 font-mono text-[12px] leading-relaxed text-slate-900"
              ></textarea>
              <div class="mt-1 text-[11px] text-slate-500">
                Used as fallback for email clients without HTML support. If empty, generated automatically from the HTML.
              </div>
            </div>

            <div *ngIf="formError" class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {{ formError }}
            </div>
          </div>
        </section>

        <!-- RIGHT: PREVIEW -->
        <aside class="flex flex-col overflow-hidden border-l border-slate-200 bg-slate-100">
          <div class="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-600">Preview</div>
            <div class="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-0.5">
              <button
                *ngFor="let v of viewports"
                type="button"
                (click)="viewport = v.key"
                class="rounded px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition"
                [ngClass]="viewport === v.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'"
              >
                {{ v.label }}
              </button>
            </div>
          </div>

          <div class="flex-1 overflow-y-auto p-4">
            <div *ngIf="!preview && !previewLoading" class="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-8 text-center text-sm text-slate-500">
              Start typing in the editor and the preview will appear here.
            </div>
            <div *ngIf="previewLoading" class="text-center text-xs text-slate-500">Rendering…</div>

            <ng-container *ngIf="preview && viewport !== 'source'">
              <!-- Fake email client wrapper -->
              <div
                class="mx-auto overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all"
                [class.max-w-md]="viewport === 'mobile'"
                [class.max-w-full]="viewport === 'desktop'"
              >
                <!-- Email header strip -->
                <div class="border-b border-slate-100 px-4 py-3 text-xs">
                  <div class="flex items-center justify-between text-slate-500">
                    <div class="flex items-center gap-2">
                      <div class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold uppercase text-white">
                        AL
                      </div>
                      <div>
                        <div class="text-slate-900">AurumLedger</div>
                        <div class="text-[10px] text-slate-400">to {{ testEmail || 'you@example.com' }}</div>
                      </div>
                    </div>
                    <div class="text-[10px] text-slate-400">now</div>
                  </div>
                  <div class="mt-2 font-semibold text-slate-900">{{ preview.subject }}</div>
                </div>
                <!-- Iframe with rendered HTML -->
                <iframe
                  #previewFrame
                  [srcdoc]="preview.html"
                  sandbox=""
                  class="w-full"
                  [style.height.px]="previewHeight"
                ></iframe>
              </div>
            </ng-container>

            <ng-container *ngIf="preview && viewport === 'source'">
              <div class="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div class="border-b border-slate-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Subject
                </div>
                <pre class="overflow-x-auto px-4 py-2 text-[11px] text-slate-900">{{ preview.subject }}</pre>
                <div class="border-y border-slate-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  HTML
                </div>
                <pre class="overflow-x-auto px-4 py-2 text-[11px] text-slate-900 whitespace-pre-wrap">{{ preview.html }}</pre>
                <div class="border-y border-slate-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Text fallback
                </div>
                <pre class="overflow-x-auto px-4 py-2 text-[11px] text-slate-900 whitespace-pre-wrap">{{ preview.text }}</pre>
              </div>
            </ng-container>
          </div>
        </aside>
      </div>
    </div>
  `,
})
export class TemplateEditorComponent implements OnInit {
  @ViewChild('previewFrame') previewFrame?: ElementRef<HTMLIFrameElement>;

  templateId: string | null = null;
  isNew = false;
  isSystem = false;

  events: EventDefinition[] = [];
  groups: TemplateGroup[] = [];

  form = {
    name: '',
    description: '',
    groupId: '',
    eventKey: '',
    subject: '',
    bodyHtml: '<p>Write your message here…</p>',
    bodyText: '',
    isActive: true,
  };

  preview: RenderPreview | null = null;
  previewLoading = false;
  previewHeight = 480;

  viewport: Viewport = 'desktop';
  viewports = [
    { key: 'desktop' as Viewport, label: 'Desktop' },
    { key: 'mobile' as Viewport, label: 'Mobile' },
    { key: 'source' as Viewport, label: 'Source' },
  ];

  lastFocusedField: 'subject' | 'body' = 'body';
  isSaving = false;
  formError = '';

  testEmail = '';
  isSendingTest = false;
  testResult: { ok: boolean; reason?: string } | null = null;

  private previewTimer: ReturnType<typeof setTimeout> | null = null;

  get selectedEvent() {
    return this.events.find((e) => e.key === this.form.eventKey);
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly api: NotificationsEngineApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    const id = this.route.snapshot.params['id'];
    this.templateId = id && id !== 'new' ? id : null;
    this.isNew = !this.templateId;

    forkJoin({
      events: this.api.events(),
      groups: this.api.listGroups(),
      template: this.templateId
        ? this.api.findTemplate(this.templateId).pipe(catchError(() => of(null)))
        : of(null),
    }).subscribe({
      next: ({ events, groups, template }) => {
        this.events = events;
        this.groups = groups;
        if (template) {
          this.isSystem = template.isSystem;
          const gid = typeof template.groupId === 'string' ? template.groupId : template.groupId?._id;
          this.form = {
            name: template.name,
            description: template.description ?? '',
            groupId: gid ?? '',
            eventKey: template.eventKey ?? '',
            subject: template.subject,
            bodyHtml: template.bodyHtml,
            bodyText: template.bodyText ?? '',
            isActive: template.isActive,
          };
        }
        this.schedulePreviewRefresh();
      },
    });

    // Live preview on form change (debounced)
    setInterval(() => this.maybeAutoPreview(), 800);
  }

  private lastPreviewSignature = '';
  private maybeAutoPreview() {
    const sig = `${this.form.subject}::${this.form.bodyHtml}::${this.form.bodyText}::${this.form.eventKey}`;
    if (sig === this.lastPreviewSignature) return;
    this.lastPreviewSignature = sig;
    this.schedulePreviewRefresh();
  }

  schedulePreviewRefresh() {
    if (this.previewTimer) clearTimeout(this.previewTimer);
    this.previewTimer = setTimeout(() => this.refreshPreview(), 200);
  }

  refreshPreview() {
    if (!this.form.subject?.trim() || !this.form.bodyHtml?.trim()) {
      this.preview = null;
      return;
    }
    this.previewLoading = true;
    this.api
      .preview({
        subject: this.form.subject,
        bodyHtml: this.form.bodyHtml,
        bodyText: this.form.bodyText || undefined,
        eventKey: this.form.eventKey || undefined,
      })
      .subscribe({
        next: (p) => {
          this.preview = p;
          this.previewLoading = false;
          setTimeout(() => this.resizePreview(), 100);
        },
        error: () => {
          this.previewLoading = false;
        },
      });
  }

  private resizePreview() {
    try {
      const frame = this.previewFrame?.nativeElement;
      if (!frame) return;
      const doc = frame.contentDocument;
      if (!doc) return;
      const height = doc.documentElement.scrollHeight || doc.body?.scrollHeight || 480;
      this.previewHeight = Math.max(360, Math.min(2000, height + 24));
    } catch {
      // ignore (sandbox can prevent inspection in some browsers)
    }
  }

  onEventChange() {
    this.schedulePreviewRefresh();
  }

  placeholdersForEditor() {
    return this.selectedEvent?.placeholders ?? [];
  }

  insertPlaceholder(text: string) {
    if (this.lastFocusedField === 'subject') {
      this.form.subject = (this.form.subject ?? '') + text;
    } else {
      this.form.bodyHtml = (this.form.bodyHtml ?? '') + text;
    }
    this.schedulePreviewRefresh();
  }

  save() {
    if (!this.form.name?.trim() || !this.form.subject?.trim() || !this.form.bodyHtml?.trim()) {
      this.formError = 'Name, subject and body are required.';
      return;
    }
    this.isSaving = true;
    this.formError = '';
    const payload = {
      name: this.form.name.trim(),
      description: this.form.description || undefined,
      groupId: this.form.groupId || undefined,
      eventKey: this.form.eventKey || undefined,
      subject: this.form.subject,
      bodyHtml: this.form.bodyHtml,
      bodyText: this.form.bodyText || undefined,
      isActive: this.form.isActive,
    };
    const obs = this.templateId
      ? this.api.updateTemplate(this.templateId, payload)
      : this.api.createTemplate(payload);
    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.router.navigate(['/notification-center']);
      },
      error: (err) => {
        this.isSaving = false;
        this.formError = err?.error?.message ?? 'Unable to save template';
      },
    });
  }

  sendTest() {
    if (!this.templateId || !this.testEmail) return;
    this.isSendingTest = true;
    this.testResult = null;
    this.api.testSend(this.templateId, { to: this.testEmail }).subscribe({
      next: (res) => {
        this.isSendingTest = false;
        this.testResult = res.ok ? { ok: true } : { ok: false, reason: res.reason };
      },
      error: (err) => {
        this.isSendingTest = false;
        this.testResult = { ok: false, reason: err?.error?.message ?? 'Send failed' };
      },
    });
  }
}
