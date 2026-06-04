import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import { NotificationsEngineApiService } from '../../core/services/notifications-engine-api.service';
import {
  EventDefinition,
  NotificationLogEntry,
  NotificationRule,
  NotificationTemplate,
  RenderPreview,
  TemplateGroup,
} from '../../core/models/notification-engine.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';

type Tab = 'templates' | 'rules' | 'log';

@Component({
  selector: 'app-notification-center',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ActionMenuComponent],
  template: `
    <div class="space-y-6">
      <header>
        <div class="text-2xl font-semibold text-slate-900">Notification Center</div>
        <div class="text-sm text-slate-500">
          Email templates, rules, and delivery log. The scheduler scans every hour and dispatches notifications based on the enabled rules.
        </div>
      </header>

      <!-- Tabs -->
      <div class="flex flex-wrap gap-1 border-b border-slate-200">
        <button
          *ngFor="let t of tabs"
          (click)="activeTab = t.key"
          class="rounded-t-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
          [ngClass]="
            activeTab === t.key
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
          "
        >
          {{ t.label }}
        </button>
      </div>

      <!-- ============ TEMPLATES ============ -->
      <div *ngIf="activeTab === 'templates'" class="grid gap-4 lg:grid-cols-[280px_1fr]">
        <aside class="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div class="mb-3 flex items-center justify-between">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Groups</div>
            <button class="text-xs text-slate-600 hover:text-slate-900" (click)="openGroupForm()">+ New</button>
          </div>
          <ul class="space-y-1">
            <li>
              <button
                class="block w-full rounded px-2 py-1.5 text-left text-sm transition"
                [ngClass]="
                  !selectedGroupId
                    ? 'bg-slate-100 font-semibold text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
                "
                (click)="selectGroup(null)"
              >
                All groups
              </button>
            </li>
            <li *ngFor="let g of groups">
              <button
                class="block w-full rounded px-2 py-1.5 text-left text-sm transition"
                [ngClass]="
                  selectedGroupId === g._id
                    ? 'bg-slate-100 font-semibold text-slate-900'
                    : 'text-slate-700 hover:bg-slate-50'
                "
                (click)="selectGroup(g._id)"
              >
                <div class="flex items-center justify-between">
                  <span>{{ g.name }}</span>
                  <span class="text-xs text-slate-400">{{ countInGroup(g._id) }}</span>
                </div>
              </button>
            </li>
          </ul>
        </aside>

        <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div class="text-sm font-semibold text-slate-900">Templates</div>
            <button
              class="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
              (click)="openTemplateEditor()"
            >
              + New template
            </button>
          </div>

          <div
            *ngIf="filteredTemplates().length === 0"
            class="px-5 py-10 text-center text-sm text-slate-500"
          >
            No templates in this group yet.
          </div>

          <ul *ngIf="filteredTemplates().length > 0" class="divide-y divide-slate-100">
            <li
              *ngFor="let tpl of filteredTemplates()"
              class="flex items-start justify-between gap-3 px-5 py-4"
            >
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-semibold text-slate-900">{{ tpl.name }}</span>
                  <span
                    *ngIf="tpl.isSystem"
                    class="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-indigo-700"
                    >system</span
                  >
                  <span
                    *ngIf="!tpl.isActive"
                    class="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-500"
                    >inactive</span
                  >
                </div>
                <div *ngIf="tpl.eventKey" class="mt-1 font-mono text-[11px] text-slate-500">
                  {{ tpl.eventKey }}
                </div>
                <div class="mt-1 truncate text-xs text-slate-600">{{ tpl.subject }}</div>
              </div>
              <app-action-menu [items]="templateActions(tpl)" />
            </li>
          </ul>
        </section>
      </div>

      <!-- ============ RULES ============ -->
      <div *ngIf="activeTab === 'rules'" class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div>
            <div class="text-sm font-semibold text-slate-900">Rules</div>
            <div class="text-xs text-slate-500">When this event fires, send this template to these recipients.</div>
          </div>
          <button
            class="rounded bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white"
            (click)="openRuleEditor()"
          >
            + New rule
          </button>
        </div>

        <div *ngIf="rules.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No rules yet. Create one to start receiving emails.
        </div>

        <ul *ngIf="rules.length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let r of rules" class="flex items-start justify-between gap-3 px-5 py-4">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-slate-900">{{ r.name }}</span>
                <span
                  class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                  [ngClass]="
                    r.enabled
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-slate-100 text-slate-500'
                  "
                  >{{ r.enabled ? 'enabled' : 'disabled' }}</span
                >
              </div>
              <div class="mt-1 font-mono text-[11px] text-slate-500">{{ r.eventKey }}</div>
              <div class="mt-1 text-xs text-slate-600">
                Template: <span class="font-semibold">{{ ruleTemplateName(r) }}</span>
              </div>
              <div class="mt-1 text-xs text-slate-600">
                Recipients:
                <span *ngFor="let exp of r.recipients; let i = index" class="text-slate-900">
                  <span *ngIf="i > 0">, </span>
                  <span class="font-mono">{{ exp }}</span>
                </span>
              </div>
              <div *ngIf="hasConditions(r)" class="mt-1 text-xs text-slate-500">
                Conditions:
                <span *ngFor="let k of conditionKeys(r); let i = index">
                  <span *ngIf="i > 0">, </span>
                  <span class="font-mono">{{ k }}={{ r.conditions[k] }}</span>
                </span>
              </div>
            </div>
            <app-action-menu [items]="ruleActions(r)" />
          </li>
        </ul>
      </div>

      <!-- ============ LOG ============ -->
      <div *ngIf="activeTab === 'log'" class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex items-center justify-between border-b border-slate-100 px-5 py-3">
          <div class="text-sm font-semibold text-slate-900">Recent activity</div>
          <button class="text-xs text-slate-500 hover:text-slate-900" (click)="loadLog()">Refresh</button>
        </div>

        <div *ngIf="log.length === 0" class="px-5 py-10 text-center text-sm text-slate-500">
          No notifications have been dispatched yet.
        </div>

        <ul *ngIf="log.length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let entry of log" class="px-5 py-3 text-sm">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-slate-900">{{ entry.subject }}</span>
                  <span
                    class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                    [ngClass]="statusBadge(entry.status)"
                  >
                    {{ entry.status }}
                  </span>
                </div>
                <div class="text-xs text-slate-500">
                  to <span class="text-slate-900">{{ entry.recipient }}</span>
                  <span *ngIf="entry.eventKey"> · <span class="font-mono">{{ entry.eventKey }}</span></span>
                  <span *ngIf="entry.createdAt"> · {{ formatDateTime(entry.createdAt) }}</span>
                </div>
                <div *ngIf="entry.error" class="mt-1 text-xs text-rose-600">{{ entry.error }}</div>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <!-- ===== Template editor modal ===== -->
    <div
      *ngIf="isTemplateEditorOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div class="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <div class="text-lg font-semibold text-slate-900">
              {{ editingTemplate ? 'Edit template' : 'New template' }}
            </div>
            <div class="text-xs text-slate-500">
              Uses Handlebars syntax. Click a placeholder chip to insert it at the cursor.
            </div>
          </div>
          <button class="text-slate-400" (click)="closeTemplateEditor()">×</button>
        </div>

        <div class="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-2">
          <!-- Editor side -->
          <div class="space-y-3 overflow-y-auto border-r border-slate-100 p-6">
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
                <input
                  [(ngModel)]="templateForm.name"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Group</label>
                <select
                  [(ngModel)]="templateForm.groupId"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option [ngValue]="''">— None —</option>
                  <option *ngFor="let g of groups" [ngValue]="g._id">{{ g.name }}</option>
                </select>
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Event</label>
              <select
                [(ngModel)]="templateForm.eventKey"
                (ngModelChange)="onEventChange()"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option [ngValue]="''">— Generic / no event —</option>
                <option *ngFor="let e of events" [ngValue]="e.key">{{ e.label }}</option>
              </select>
              <div *ngIf="selectedEvent" class="mt-1 text-xs text-slate-500">{{ selectedEvent.description }}</div>
            </div>

            <div *ngIf="placeholdersForEditor().length > 0">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-600">Placeholders</div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <button
                  *ngFor="let ph of placeholdersForEditor()"
                  type="button"
                  class="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-700 transition hover:border-slate-400 hover:bg-slate-100"
                  [title]="ph.description"
                  (click)="insertPlaceholder('{{ ' + ph.path + ' }}')"
                >
                  {{ ph.path }}
                </button>
              </div>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Subject</label>
              <input
                #subjectInput
                [(ngModel)]="templateForm.subject"
                (focus)="lastFocusedField = 'subject'"
                placeholder="e.g. {{ '{{client.name}}' }} contract expires soon"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Body (HTML)</label>
              <textarea
                #bodyInput
                [(ngModel)]="templateForm.bodyHtml"
                (focus)="lastFocusedField = 'body'"
                rows="14"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              ></textarea>
            </div>

            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Text fallback (optional)</label>
              <textarea
                [(ngModel)]="templateForm.bodyText"
                rows="3"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-mono"
              ></textarea>
            </div>

            <label class="flex items-center gap-2 text-xs text-slate-700">
              <input type="checkbox" [(ngModel)]="templateForm.isActive" />
              Template is active (rules can use it)
            </label>

            <div *ngIf="templateError" class="text-sm text-rose-600">{{ templateError }}</div>
          </div>

          <!-- Preview side -->
          <div class="flex flex-col overflow-hidden">
            <div class="flex items-center justify-between border-b border-slate-100 px-6 py-3">
              <div class="text-xs font-semibold uppercase tracking-wide text-slate-600">Preview</div>
              <button
                type="button"
                class="text-xs text-slate-700 underline hover:text-slate-900"
                (click)="refreshPreview()"
              >
                Refresh preview
              </button>
            </div>
            <div class="overflow-y-auto px-6 py-4">
              <div *ngIf="preview">
                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Subject</div>
                <div class="mb-3 font-semibold text-slate-900">{{ preview.subject }}</div>

                <div class="text-[11px] font-semibold uppercase tracking-wide text-slate-500">HTML</div>
                <div
                  class="mt-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
                >
                  <iframe
                    [srcdoc]="preview.html"
                    sandbox=""
                    class="h-[420px] w-full rounded bg-white"
                  ></iframe>
                </div>
              </div>
              <div *ngIf="!preview" class="text-sm text-slate-500">Click "Refresh preview" to render with sample data.</div>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
          <div class="flex items-center gap-2">
            <input
              type="email"
              [(ngModel)]="testEmail"
              placeholder="your@email.com"
              class="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              [disabled]="!editingTemplate?._id || !testEmail || isSendingTest"
              (click)="sendTest()"
              class="rounded border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 disabled:opacity-40"
            >
              {{ isSendingTest ? 'Sending…' : 'Send test' }}
            </button>
            <span *ngIf="testResult" class="text-xs" [ngClass]="testResult.ok ? 'text-emerald-700' : 'text-rose-700'">
              {{ testResult.ok ? 'Sent ✓' : testResult.reason }}
            </span>
          </div>
          <div class="flex gap-2">
            <button
              type="button"
              class="rounded border border-slate-200 px-4 py-2 text-xs uppercase tracking-wide text-slate-700"
              (click)="closeTemplateEditor()"
            >
              Cancel
            </button>
            <button
              type="button"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-40"
              [disabled]="isSavingTemplate"
              (click)="saveTemplate()"
            >
              {{ isSavingTemplate ? 'Saving…' : 'Save template' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== Group form modal ===== -->
    <div
      *ngIf="isGroupFormOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
        <div class="text-lg font-semibold text-slate-900">New group</div>
        <div class="mt-3 space-y-2">
          <input
            [(ngModel)]="groupForm.name"
            placeholder="Group name"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <input
            [(ngModel)]="groupForm.description"
            placeholder="Description (optional)"
            class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </div>
        <div class="mt-4 flex justify-end gap-2">
          <button
            class="rounded border border-slate-200 px-4 py-2 text-xs uppercase text-slate-700"
            (click)="isGroupFormOpen = false"
          >
            Cancel
          </button>
          <button
            class="rounded bg-slate-900 px-4 py-2 text-xs uppercase text-white"
            [disabled]="!groupForm.name?.trim()"
            (click)="saveGroup()"
          >
            Save
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Rule editor modal ===== -->
    <div
      *ngIf="isRuleEditorOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="text-lg font-semibold text-slate-900">{{ editingRule ? 'Edit rule' : 'New rule' }}</div>

        <div class="mt-4 space-y-3">
          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
            <input
              [(ngModel)]="ruleForm.name"
              placeholder="e.g. Notify 30 days before contract expiry"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Event</label>
            <select
              [(ngModel)]="ruleForm.eventKey"
              (ngModelChange)="onRuleEventChange()"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option *ngFor="let e of events" [ngValue]="e.key">{{ e.label }}</option>
            </select>
            <div *ngIf="selectedRuleEvent" class="mt-1 text-xs text-slate-500">{{ selectedRuleEvent.description }}</div>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Template</label>
            <select
              [(ngModel)]="ruleForm.templateId"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option [ngValue]="''">— Select template —</option>
              <option *ngFor="let t of templatesForRule()" [ngValue]="t._id">{{ t.name }}</option>
            </select>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Recipients</label>
            <div class="mt-1 space-y-1.5">
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  [checked]="recipientChecked('project.assignedTo')"
                  (change)="toggleRecipient('project.assignedTo', $any($event.target).checked)"
                />
                Project assignee
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  [checked]="recipientChecked('contract.client')"
                  (change)="toggleRecipient('contract.client', $any($event.target).checked)"
                />
                Contract client
              </label>
              <label class="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  [checked]="recipientChecked('admin')"
                  (change)="toggleRecipient('admin', $any($event.target).checked)"
                />
                All admins
              </label>
              <div class="flex items-center gap-2">
                <input
                  [(ngModel)]="customRecipientEmail"
                  placeholder="custom@email.com"
                  class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  class="text-xs text-slate-700"
                  (click)="addCustomRecipient()"
                >
                  + Add
                </button>
              </div>
              <div *ngFor="let r of customRecipients()" class="flex items-center gap-2 text-xs">
                <span class="font-mono text-slate-700">{{ r }}</span>
                <button class="text-rose-600" (click)="removeCustomRecipient(r)">remove</button>
              </div>
            </div>
          </div>

          <div *ngIf="selectedRuleEvent?.conditions && (selectedRuleEvent?.conditions?.length || 0) > 0">
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Conditions (optional)</label>
            <div class="mt-1 space-y-2">
              <div *ngFor="let c of selectedRuleEvent!.conditions" class="flex items-center gap-2">
                <span class="w-44 text-xs text-slate-600">{{ c.label }}</span>
                <input
                  [type]="c.type === 'number' ? 'number' : 'text'"
                  [(ngModel)]="ruleConditions[c.key]"
                  class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm"
                />
              </div>
            </div>
          </div>

          <label class="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" [(ngModel)]="ruleForm.enabled" />
            Rule is enabled
          </label>

          <div *ngIf="ruleError" class="text-sm text-rose-600">{{ ruleError }}</div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button
            class="rounded border border-slate-200 px-4 py-2 text-xs uppercase text-slate-700"
            (click)="closeRuleEditor()"
          >
            Cancel
          </button>
          <button
            class="rounded bg-slate-900 px-4 py-2 text-xs uppercase text-white"
            [disabled]="isSavingRule"
            (click)="saveRule()"
          >
            {{ isSavingRule ? 'Saving…' : 'Save rule' }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class NotificationCenterComponent implements OnInit {
  activeTab: Tab = 'templates';

  events: EventDefinition[] = [];
  groups: TemplateGroup[] = [];
  templates: NotificationTemplate[] = [];
  rules: NotificationRule[] = [];
  log: NotificationLogEntry[] = [];

  selectedGroupId: string | null = null;

  // Template editor state
  isTemplateEditorOpen = false;
  editingTemplate: NotificationTemplate | null = null;
  templateForm: {
    name: string;
    groupId: string;
    eventKey: string;
    subject: string;
    bodyHtml: string;
    bodyText: string;
    isActive: boolean;
  } = this.emptyTemplateForm();
  templateError = '';
  isSavingTemplate = false;
  preview: RenderPreview | null = null;
  testEmail = '';
  isSendingTest = false;
  testResult: { ok: boolean; reason?: string } | null = null;
  lastFocusedField: 'subject' | 'body' = 'body';

  // Group form
  isGroupFormOpen = false;
  groupForm: { name: string; description: string } = { name: '', description: '' };

  // Rule editor state
  isRuleEditorOpen = false;
  editingRule: NotificationRule | null = null;
  ruleForm: {
    name: string;
    eventKey: string;
    templateId: string;
    enabled: boolean;
  } = { name: '', eventKey: '', templateId: '', enabled: true };
  ruleRecipientsList: string[] = [];
  ruleConditions: Record<string, string | number> = {};
  customRecipientEmail = '';
  ruleError = '';
  isSavingRule = false;

  get tabs() {
    return [
      { key: 'templates' as Tab, label: 'Templates' },
      { key: 'rules' as Tab, label: 'Rules' },
      { key: 'log' as Tab, label: 'Log' },
    ];
  }

  get selectedEvent(): EventDefinition | undefined {
    return this.events.find((e) => e.key === this.templateForm.eventKey);
  }
  get selectedRuleEvent(): EventDefinition | undefined {
    return this.events.find((e) => e.key === this.ruleForm.eventKey);
  }

  constructor(
    private readonly api: NotificationsEngineApiService,
    private readonly confirmDialog: ConfirmService,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit() {
    forkJoin({
      events: this.api.events(),
      groups: this.api.listGroups(),
      templates: this.api.listTemplates(),
      rules: this.api.listRules(),
    }).subscribe({
      next: ({ events, groups, templates, rules }) => {
        this.events = events;
        this.groups = groups;
        this.templates = templates;
        this.rules = rules;
      },
    });
    this.loadLog();
  }

  loadLog() {
    this.api.log({ limit: 100 }).subscribe({ next: (l) => (this.log = l) });
  }

  // ---------- groups ----------
  countInGroup(groupId: string): number {
    return this.templates.filter((t) => this.groupOf(t) === groupId).length;
  }
  groupOf(tpl: NotificationTemplate): string {
    if (!tpl.groupId) return '';
    return typeof tpl.groupId === 'string' ? tpl.groupId : tpl.groupId._id;
  }
  selectGroup(groupId: string | null) {
    this.selectedGroupId = groupId;
  }
  openGroupForm() {
    this.groupForm = { name: '', description: '' };
    this.isGroupFormOpen = true;
  }
  saveGroup() {
    if (!this.groupForm.name?.trim()) return;
    this.api.createGroup(this.groupForm).subscribe({
      next: (g) => {
        this.groups = [...this.groups, g].sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
        this.isGroupFormOpen = false;
      },
    });
  }

  // ---------- templates ----------
  filteredTemplates() {
    if (!this.selectedGroupId) return this.templates;
    return this.templates.filter((t) => this.groupOf(t) === this.selectedGroupId);
  }
  templateActions(tpl: NotificationTemplate): ActionMenuItem[] {
    return [
      { label: 'Edit', action: () => this.openTemplateEditor(tpl) },
      { label: 'Duplicate', action: () => this.duplicateTemplate(tpl) },
      {
        label: tpl.isActive ? 'Deactivate' : 'Activate',
        action: () => this.toggleTemplateActive(tpl),
      },
      {
        label: 'Delete',
        action: () => this.removeTemplate(tpl),
        danger: true,
        disabled: tpl.isSystem,
      },
    ];
  }
  openTemplateEditor(tpl?: NotificationTemplate) {
    this.editingTemplate = tpl ?? null;
    this.templateError = '';
    this.testEmail = '';
    this.testResult = null;
    this.preview = null;
    this.templateForm = tpl
      ? {
          name: tpl.name,
          groupId: this.groupOf(tpl) || '',
          eventKey: tpl.eventKey ?? '',
          subject: tpl.subject,
          bodyHtml: tpl.bodyHtml,
          bodyText: tpl.bodyText ?? '',
          isActive: tpl.isActive,
        }
      : this.emptyTemplateForm();
    this.isTemplateEditorOpen = true;
    setTimeout(() => this.refreshPreview(), 0);
  }
  closeTemplateEditor() {
    this.isTemplateEditorOpen = false;
    this.editingTemplate = null;
    this.preview = null;
  }
  saveTemplate() {
    if (!this.templateForm.name?.trim() || !this.templateForm.subject?.trim() || !this.templateForm.bodyHtml?.trim()) {
      this.templateError = 'Name, subject and body are required.';
      return;
    }
    this.isSavingTemplate = true;
    this.templateError = '';
    const payload: Partial<NotificationTemplate> = {
      name: this.templateForm.name.trim(),
      groupId: this.templateForm.groupId || undefined,
      eventKey: this.templateForm.eventKey || undefined,
      subject: this.templateForm.subject,
      bodyHtml: this.templateForm.bodyHtml,
      bodyText: this.templateForm.bodyText || undefined,
      isActive: this.templateForm.isActive,
    };
    const obs = this.editingTemplate
      ? this.api.updateTemplate(this.editingTemplate._id, payload)
      : this.api.createTemplate(payload);
    obs.subscribe({
      next: () => {
        this.isSavingTemplate = false;
        this.closeTemplateEditor();
        this.api.listTemplates().subscribe({ next: (items) => (this.templates = items) });
      },
      error: (err) => {
        this.isSavingTemplate = false;
        this.templateError = err?.error?.message ?? 'Unable to save template';
      },
    });
  }
  async removeTemplate(tpl: NotificationTemplate) {
    const ok = await this.confirmDialog.open({
      title: 'Delete template',
      message: `Delete "${tpl.name}"? Rules using it will stop firing.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteTemplate(tpl._id).subscribe({
      next: () => {
        this.templates = this.templates.filter((t) => t._id !== tpl._id);
      },
    });
  }
  toggleTemplateActive(tpl: NotificationTemplate) {
    this.api.updateTemplate(tpl._id, { isActive: !tpl.isActive }).subscribe({
      next: (updated) => {
        const idx = this.templates.findIndex((t) => t._id === tpl._id);
        if (idx >= 0) this.templates[idx] = updated;
      },
    });
  }
  duplicateTemplate(tpl: NotificationTemplate) {
    this.openTemplateEditor({
      ...tpl,
      _id: '',
      name: `${tpl.name} (copy)`,
      isSystem: false,
    } as NotificationTemplate);
    this.editingTemplate = null;
  }
  emptyTemplateForm() {
    return {
      name: '',
      groupId: '',
      eventKey: '',
      subject: '',
      bodyHtml: '<p>Write your message here…</p>',
      bodyText: '',
      isActive: true,
    };
  }
  onEventChange() {
    this.refreshPreview();
  }
  placeholdersForEditor() {
    if (!this.selectedEvent) return [];
    return this.selectedEvent.placeholders;
  }
  insertPlaceholder(text: string) {
    if (this.lastFocusedField === 'subject') {
      this.templateForm.subject = (this.templateForm.subject ?? '') + text;
    } else {
      this.templateForm.bodyHtml = (this.templateForm.bodyHtml ?? '') + text;
    }
  }
  refreshPreview() {
    if (!this.templateForm.subject || !this.templateForm.bodyHtml) {
      this.preview = null;
      return;
    }
    this.api
      .preview({
        subject: this.templateForm.subject,
        bodyHtml: this.templateForm.bodyHtml,
        bodyText: this.templateForm.bodyText || undefined,
        eventKey: this.templateForm.eventKey || undefined,
      })
      .subscribe({
        next: (p) => (this.preview = p),
        error: () => (this.preview = null),
      });
  }
  sendTest() {
    if (!this.editingTemplate?._id) return;
    this.isSendingTest = true;
    this.testResult = null;
    this.api.testSend(this.editingTemplate._id, { to: this.testEmail }).subscribe({
      next: (res) => {
        this.isSendingTest = false;
        this.testResult = res.ok
          ? { ok: true }
          : { ok: false, reason: res.reason };
      },
      error: (err) => {
        this.isSendingTest = false;
        this.testResult = { ok: false, reason: err?.error?.message ?? 'Send failed' };
      },
    });
  }

  // ---------- rules ----------
  ruleActions(r: NotificationRule): ActionMenuItem[] {
    return [
      { label: 'Edit', action: () => this.openRuleEditor(r) },
      { label: r.enabled ? 'Disable' : 'Enable', action: () => this.toggleRuleEnabled(r) },
      { label: 'Delete', action: () => this.removeRule(r), danger: true },
    ];
  }
  ruleTemplateName(r: NotificationRule) {
    if (typeof r.templateId === 'string') return r.templateId;
    return r.templateId?.name ?? '—';
  }
  hasConditions(r: NotificationRule) {
    return r.conditions && Object.keys(r.conditions).length > 0;
  }
  conditionKeys(r: NotificationRule) {
    return Object.keys(r.conditions ?? {});
  }
  openRuleEditor(r?: NotificationRule) {
    this.editingRule = r ?? null;
    this.ruleError = '';
    this.ruleConditions = { ...(r?.conditions ?? {}) } as Record<string, string | number>;
    this.ruleRecipientsList = r ? [...r.recipients] : ['project.assignedTo'];
    this.ruleForm = r
      ? {
          name: r.name,
          eventKey: r.eventKey,
          templateId: typeof r.templateId === 'string' ? r.templateId : r.templateId._id,
          enabled: r.enabled,
        }
      : {
          name: '',
          eventKey: this.events[0]?.key ?? '',
          templateId: '',
          enabled: true,
        };
    this.isRuleEditorOpen = true;
  }
  closeRuleEditor() {
    this.isRuleEditorOpen = false;
    this.editingRule = null;
  }
  onRuleEventChange() {
    const ev = this.selectedRuleEvent;
    if (ev && !this.editingRule) {
      this.ruleRecipientsList = [...ev.defaultRecipients];
    }
  }
  templatesForRule() {
    if (!this.ruleForm.eventKey) return this.templates;
    return this.templates.filter((t) => t.eventKey === this.ruleForm.eventKey || !t.eventKey);
  }
  recipientChecked(expression: string) {
    return this.ruleRecipientsList.includes(expression);
  }
  toggleRecipient(expression: string, checked: boolean) {
    if (checked) {
      if (!this.ruleRecipientsList.includes(expression)) this.ruleRecipientsList.push(expression);
    } else {
      this.ruleRecipientsList = this.ruleRecipientsList.filter((r) => r !== expression);
    }
  }
  customRecipients() {
    return this.ruleRecipientsList.filter((r) => r.startsWith('custom:'));
  }
  addCustomRecipient() {
    const email = (this.customRecipientEmail || '').trim();
    if (!email) return;
    const expr = `custom:${email}`;
    if (!this.ruleRecipientsList.includes(expr)) {
      this.ruleRecipientsList.push(expr);
    }
    this.customRecipientEmail = '';
  }
  removeCustomRecipient(r: string) {
    this.ruleRecipientsList = this.ruleRecipientsList.filter((x) => x !== r);
  }
  saveRule() {
    if (!this.ruleForm.name?.trim() || !this.ruleForm.eventKey || !this.ruleForm.templateId) {
      this.ruleError = 'Name, event and template are required.';
      return;
    }
    if (this.ruleRecipientsList.length === 0) {
      this.ruleError = 'At least one recipient is required.';
      return;
    }
    const conditions: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(this.ruleConditions)) {
      if (v === '' || v === null || v === undefined) continue;
      conditions[k] = v;
    }
    this.isSavingRule = true;
    const payload = {
      name: this.ruleForm.name.trim(),
      eventKey: this.ruleForm.eventKey,
      templateId: this.ruleForm.templateId,
      recipients: this.ruleRecipientsList,
      conditions,
      enabled: this.ruleForm.enabled,
    };
    const obs = this.editingRule
      ? this.api.updateRule(this.editingRule._id, payload)
      : this.api.createRule(payload);
    obs.subscribe({
      next: () => {
        this.isSavingRule = false;
        this.closeRuleEditor();
        this.api.listRules().subscribe({ next: (rules) => (this.rules = rules) });
      },
      error: (err) => {
        this.isSavingRule = false;
        this.ruleError = err?.error?.message ?? 'Unable to save rule';
      },
    });
  }
  toggleRuleEnabled(r: NotificationRule) {
    this.api.updateRule(r._id, { enabled: !r.enabled }).subscribe({
      next: (updated) => {
        const idx = this.rules.findIndex((x) => x._id === r._id);
        if (idx >= 0) this.rules[idx] = updated;
      },
    });
  }
  async removeRule(r: NotificationRule) {
    const ok = await this.confirmDialog.open({
      title: 'Delete rule',
      message: `Delete rule "${r.name}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.deleteRule(r._id).subscribe({
      next: () => {
        this.rules = this.rules.filter((x) => x._id !== r._id);
      },
    });
  }

  // ---------- helpers ----------
  statusBadge(status: string) {
    switch (status) {
      case 'sent':
        return 'bg-emerald-50 text-emerald-700';
      case 'failed':
        return 'bg-rose-50 text-rose-700';
      case 'skipped':
        return 'bg-slate-100 text-slate-500';
      default:
        return 'bg-amber-50 text-amber-700';
    }
  }
  formatDateTime(s?: string) {
    if (!s) return '';
    return new Date(s).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
