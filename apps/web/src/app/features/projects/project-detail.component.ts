import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import { ProjectsApiService } from '../../core/services/projects-api.service';
import {
  ProjectCredential,
  ProjectDeliverable,
  ProjectItem,
  ProjectNote,
  ProjectTask,
  ProjectTemplateSummary,
} from '../../core/models/project.model';
import { ActionMenuComponent, ActionMenuItem } from '../../shared/action-menu/action-menu.component';
import { SharePanelComponent, SharePanelState } from '../../shared/share-panel/share-panel.component';
import { GithubPanelComponent, GithubRepoLink } from '../../shared/github-panel/github-panel.component';
import { AttachmentsPanelComponent } from '../../shared/attachments-panel/attachments-panel.component';
import { CustomFieldsPanelComponent } from '../../shared/custom-fields-panel/custom-fields-panel.component';
import { TasksBoardComponent } from './tasks-board.component';

type Tab = 'overview' | 'tasks' | 'notes' | 'credentials' | 'deliverables';

type CredentialTypeSpec = {
  type: string;
  label: string;
  fields: Array<{ key: string; label: string; secret?: boolean; placeholder?: string }>;
};

const CREDENTIAL_TYPES: CredentialTypeSpec[] = [
  {
    type: 'ftp',
    label: 'FTP / SFTP',
    fields: [
      { key: 'host', label: 'Host', placeholder: 'ftp.example.com' },
      { key: 'port', label: 'Port', placeholder: '21' },
      { key: 'protocol', label: 'Protocol (ftp/sftp)', placeholder: 'sftp' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    type: 'mysql',
    label: 'MySQL database',
    fields: [
      { key: 'host', label: 'Host' },
      { key: 'port', label: 'Port', placeholder: '3306' },
      { key: 'database', label: 'Database name' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    type: 'postgres',
    label: 'PostgreSQL database',
    fields: [
      { key: 'host', label: 'Host' },
      { key: 'port', label: 'Port', placeholder: '5432' },
      { key: 'database', label: 'Database name' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    type: 'wordpress',
    label: 'WordPress admin',
    fields: [
      { key: 'siteUrl', label: 'Site URL', placeholder: 'https://site.com' },
      { key: 'adminUrl', label: 'Admin URL', placeholder: 'https://site.com/wp-admin' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    type: 'ssh',
    label: 'SSH / Server',
    fields: [
      { key: 'host', label: 'Host / IP' },
      { key: 'port', label: 'Port', placeholder: '22' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
      { key: 'keyNotes', label: 'Key location / notes' },
    ],
  },
  {
    type: 'hosting',
    label: 'Hosting / cPanel',
    fields: [
      { key: 'url', label: 'Control panel URL' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    type: 'api_key',
    label: 'API key',
    fields: [
      { key: 'service', label: 'Service / provider' },
      { key: 'key', label: 'Key', secret: true },
      { key: 'secret', label: 'Secret (optional)', secret: true },
      { key: 'endpoint', label: 'Endpoint' },
    ],
  },
  {
    type: 'oauth_token',
    label: 'OAuth / token',
    fields: [
      { key: 'service', label: 'Service / provider' },
      { key: 'accessToken', label: 'Access token', secret: true },
      { key: 'refreshToken', label: 'Refresh token (optional)', secret: true },
      { key: 'scopes', label: 'Scopes' },
    ],
  },
  {
    type: 'smtp',
    label: 'SMTP',
    fields: [
      { key: 'host', label: 'Host' },
      { key: 'port', label: 'Port', placeholder: '587' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
      { key: 'from', label: 'From address' },
    ],
  },
  {
    type: 'registrar',
    label: 'Domain registrar',
    fields: [
      { key: 'provider', label: 'Provider' },
      { key: 'url', label: 'Login URL' },
      { key: 'username', label: 'Username' },
      { key: 'password', label: 'Password', secret: true },
    ],
  },
  {
    type: 'generic',
    label: 'Generic / custom',
    fields: [],
  },
];

@Component({
  selector: 'app-project-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    ActionMenuComponent,
    SharePanelComponent,
    GithubPanelComponent,
    AttachmentsPanelComponent,
    CustomFieldsPanelComponent,
    TasksBoardComponent,
  ],
  template: `
    <div *ngIf="isLoading" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      Loading project…
    </div>

    <div *ngIf="!isLoading && error" class="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
      {{ error }}
    </div>

    <div *ngIf="!isLoading && project" class="space-y-6">
      <!-- Header -->
      <div class="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="min-w-0">
            <a routerLink="/projects" class="text-xs uppercase tracking-wide text-slate-500 hover:text-slate-900">
              ← All projects
            </a>
            <div class="mt-2 flex items-center gap-3">
              <h1 class="text-2xl font-semibold text-slate-900">{{ project.name }}</h1>
              <span
                class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                [ngClass]="statusBadge(project.status)"
              >
                {{ statusLabel(project.status) }}
              </span>
            </div>
            <div class="mt-2 text-sm text-slate-500">
              <span>{{ clientName() }}</span>
              <span *ngIf="serviceName()"> · {{ serviceName() }}</span>
              <span *ngIf="project.dueDate"> · Due {{ formatDate(project.dueDate) }}</span>
            </div>
            <div *ngIf="contractRef() as ctr" class="mt-1 text-xs text-slate-500">
              Contract:
              <a [routerLink]="['/contracts']" class="text-slate-700 hover:underline"
                >{{ ctr.title || ctr._id }}</a
              >
              <span *ngIf="ctr.amount"> · {{ ctr.currency }} {{ ctr.amount }}</span>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <select
              [ngModel]="project.status"
              (ngModelChange)="updateStatus($event)"
              class="rounded-lg border border-slate-200 px-3 py-2 text-xs uppercase tracking-wide text-slate-700"
            >
              <option value="active">Active</option>
              <option value="on_hold">On hold</option>
              <option value="completed">Completed</option>
              <option value="archived">Archived</option>
            </select>
            <app-action-menu [items]="headerActions()" />
          </div>
        </div>
      </div>

      <!-- Tabs -->
      <div class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div class="flex flex-wrap gap-1 border-b border-slate-100 px-3 pt-3">
          <button
            *ngFor="let tab of tabs"
            (click)="activeTab = tab.key"
            class="rounded-t-lg px-4 py-2 text-xs font-semibold uppercase tracking-wide transition"
            [ngClass]="
              activeTab === tab.key
                ? 'bg-slate-900 text-white'
                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'
            "
          >
            {{ tab.label }}
            <span *ngIf="tab.count !== undefined" class="ml-1 opacity-70">({{ tab.count }})</span>
          </button>
        </div>

        <!-- ========== OVERVIEW ========== -->
        <div *ngIf="activeTab === 'overview'" class="space-y-5 p-6">
          <div class="grid gap-4 md:grid-cols-4">
            <div class="rounded-lg bg-slate-50 p-3">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tasks</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">{{ doneTasks() }} / {{ tasks.length }}</div>
            </div>
            <div class="rounded-lg bg-slate-50 p-3">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Deliverables</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">
                {{ doneDeliverables() }} / {{ project.deliverables.length }}
              </div>
            </div>
            <div class="rounded-lg bg-slate-50 p-3">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Credentials</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">{{ credentials.length }}</div>
            </div>
            <div class="rounded-lg bg-slate-50 p-3">
              <div class="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Notes</div>
              <div class="mt-1 text-xl font-semibold text-slate-900">{{ project.notes.length }}</div>
            </div>
          </div>

          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Description</div>
            <textarea
              [(ngModel)]="descriptionDraft"
              (blur)="saveDescription()"
              rows="4"
              placeholder="Add an overview, scope of work, or any context for this project…"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <!-- Custom fields -->
          <div>
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Custom fields</div>
            <div class="mt-2">
              <app-custom-fields-panel
                entityType="project"
                [values]="projectCustomValues"
                (valuesChange)="onCustomValuesChange($event)"
              />
            </div>
          </div>
        </div>

        <!-- ========== TASKS (Kanban board) ========== -->
        <div *ngIf="activeTab === 'tasks'" class="p-4">
          <app-tasks-board [projectId]="projectId" [tasks]="tasks" />
        </div>

        <!-- ========== NOTES ========== -->
        <div *ngIf="activeTab === 'notes'" class="p-6">
          <form class="mb-4 space-y-2" (ngSubmit)="addNote()">
            <input
              [(ngModel)]="newNoteTitle"
              name="newNoteTitle"
              placeholder="Note title…"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <textarea
              [(ngModel)]="newNoteBody"
              name="newNoteBody"
              rows="3"
              placeholder="Write a note (supports plain text)…"
              class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
            <div class="flex justify-end">
              <button
                type="submit"
                [disabled]="!newNoteTitle.trim() || !newNoteBody.trim()"
                class="rounded bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
              >
                + Add note
              </button>
            </div>
          </form>

          <div *ngIf="project.notes.length === 0" class="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
            No notes yet.
          </div>

          <ul class="space-y-3">
            <li *ngFor="let note of project.notes" class="rounded-lg border border-slate-100 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="text-sm font-semibold text-slate-900">{{ note.title }}</div>
                  <div class="mt-1 whitespace-pre-wrap text-sm text-slate-700">{{ note.body }}</div>
                  <div *ngIf="note.createdAt" class="mt-2 text-[11px] text-slate-400">
                    {{ formatDateTime(note.createdAt) }}
                  </div>
                </div>
                <app-action-menu [items]="noteActions(note)" />
              </div>
            </li>
          </ul>
        </div>

        <!-- ========== CREDENTIALS ========== -->
        <div *ngIf="activeTab === 'credentials'" class="p-6">
          <div class="mb-4 flex items-center justify-between">
            <div class="text-sm text-slate-500">
              All credential values are encrypted at rest (AES-256-GCM). They're decrypted only when fetched
              by an authenticated user.
            </div>
            <button
              (click)="openCredentialForm()"
              class="rounded bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white"
            >
              + Add credential
            </button>
          </div>

          <div
            *ngIf="credentials.length === 0"
            class="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500"
          >
            No credentials stored yet.
          </div>

          <ul class="space-y-3">
            <li *ngFor="let cred of credentials" class="rounded-lg border border-slate-200 p-4">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2">
                    <span class="rounded bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">
                      {{ credentialTypeLabel(cred.type) }}
                    </span>
                    <span class="text-sm font-semibold text-slate-900">{{ cred.name }}</span>
                  </div>
                  <div class="mt-3 grid gap-2 sm:grid-cols-2">
                    <div *ngFor="let entry of fieldsEntries(cred)" class="text-xs">
                      <div class="text-[10px] uppercase tracking-wide text-slate-500">{{ entry.key }}</div>
                      <div class="flex items-center gap-2">
                        <span class="font-mono text-slate-900">
                          {{ isRevealed(cred._id, entry.key) ? entry.value : maskedValue(entry.value, entry.isSecret) }}
                        </span>
                        <button
                          *ngIf="entry.isSecret"
                          type="button"
                          class="text-[10px] uppercase text-slate-500 hover:text-slate-900"
                          (click)="toggleReveal(cred._id, entry.key)"
                        >
                          {{ isRevealed(cred._id, entry.key) ? 'Hide' : 'Show' }}
                        </button>
                        <button
                          type="button"
                          class="text-[10px] uppercase text-slate-500 hover:text-slate-900"
                          (click)="copyToClipboard(entry.value)"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>
                  <div *ngIf="cred.notes" class="mt-3 rounded-md bg-slate-50 px-2 py-1.5 text-xs text-slate-600">
                    {{ cred.notes }}
                  </div>
                </div>
                <app-action-menu [items]="credentialActions(cred)" />
              </div>
            </li>
          </ul>
        </div>

        <!-- ========== DELIVERABLES ========== -->
        <div *ngIf="activeTab === 'deliverables'" class="p-6">
          <form class="mb-4 flex items-end gap-2" (ngSubmit)="addDeliverable()">
            <input
              [(ngModel)]="newDeliverableLabel"
              name="newDeliverableLabel"
              placeholder="e.g. SSL configured…"
              class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              [disabled]="!newDeliverableLabel.trim()"
              class="rounded bg-slate-900 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
            >
              + Add
            </button>
          </form>

          <div
            *ngIf="project.deliverables.length === 0"
            class="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500"
          >
            No deliverables yet. Apply a template from the actions menu to get a checklist suited to this service.
          </div>

          <ul class="space-y-2">
            <li
              *ngFor="let item of project.deliverables"
              class="flex items-center gap-3 rounded-lg border border-slate-100 px-3 py-2.5"
            >
              <input
                type="checkbox"
                [checked]="item.done"
                (change)="toggleDeliverable(item)"
                class="h-4 w-4 rounded border-slate-300"
              />
              <div class="flex-1">
                <div
                  class="text-sm"
                  [ngClass]="item.done ? 'text-slate-400 line-through' : 'text-slate-900'"
                >{{ item.label }}</div>
                <div *ngIf="item.done && item.doneAt" class="text-[11px] text-slate-500">
                  Done {{ formatDate(item.doneAt) }}
                </div>
              </div>
              <app-action-menu [items]="deliverableActions(item)" />
            </li>
          </ul>
        </div>
      </div>

      <!-- Client portal share link -->
      <app-share-panel
        portalPath="/portal/projects"
        [state]="shareState"
        [busy]="isSharing"
        (generate)="generateShare()"
        (revoke)="revokeShare()"
      />

      <!-- GitHub repo -->
      <app-github-panel
        [projectId]="projectId"
        [repo]="project.githubRepo ?? null"
        [busy]="isGithubBusy"
        [linkError]="githubError"
        (link)="linkGithub($event)"
        (unlink)="unlinkGithub()"
      />

      <!-- Attachments -->
      <app-attachments-panel parentType="project" [parentId]="projectId" />
    </div>

    <!-- Credential modal -->
    <div
      *ngIf="isCredFormOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold text-slate-900">
            {{ editingCredential ? 'Edit credential' : 'Add credential' }}
          </div>
          <button class="text-slate-400" (click)="closeCredentialForm()">×</button>
        </div>

        <form class="mt-4 space-y-3" (ngSubmit)="saveCredential()">
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Type</label>
              <select
                [(ngModel)]="credForm.type"
                name="credType"
                (ngModelChange)="onCredTypeChange()"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option *ngFor="let t of credentialTypes" [value]="t.type">{{ t.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Name</label>
              <input
                [(ngModel)]="credForm.name"
                name="credName"
                placeholder="e.g. Production cPanel"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div *ngFor="let field of credFormSpec.fields">
              <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">{{ field.label }}</label>
              <input
                [(ngModel)]="credForm.fields[field.key]"
                [name]="'field-' + field.key"
                [type]="field.secret ? 'password' : 'text'"
                [placeholder]="field.placeholder || ''"
                class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <!-- Generic / custom: arbitrary key-value editor -->
          <div *ngIf="credForm.type === 'generic'">
            <div class="text-xs font-semibold uppercase tracking-wide text-slate-600">Custom fields</div>
            <div *ngFor="let kv of customFields; let i = index" class="mt-2 flex gap-2">
              <input
                [(ngModel)]="kv.key"
                [name]="'kvkey-' + i"
                placeholder="Field name"
                class="w-1/3 rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                [(ngModel)]="kv.value"
                [name]="'kvval-' + i"
                placeholder="Value"
                class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono"
              />
              <button
                type="button"
                class="text-xs text-rose-600"
                (click)="removeCustomField(i)"
              >
                Remove
              </button>
            </div>
            <button
              type="button"
              class="mt-2 text-xs text-slate-700"
              (click)="addCustomField()"
            >
              + Add field
            </button>
          </div>

          <div>
            <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">Notes (optional)</label>
            <textarea
              [(ngModel)]="credForm.notes"
              name="credNotes"
              rows="2"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div *ngIf="credError" class="text-sm text-rose-600">{{ credError }}</div>

          <div class="mt-2 flex justify-end gap-3">
            <button
              type="button"
              class="rounded border border-slate-200 px-4 py-2 text-xs uppercase tracking-wide text-slate-700"
              (click)="closeCredentialForm()"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="rounded bg-slate-900 px-4 py-2 text-xs uppercase tracking-wide text-white disabled:opacity-40"
              [disabled]="isSavingCred"
            >
              {{ isSavingCred ? 'Saving…' : 'Save credential' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Apply template modal -->
    <div
      *ngIf="isTemplateModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4"
    >
      <div class="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-lg font-semibold text-slate-900">Apply template</div>
          <button class="text-slate-400" (click)="isTemplateModalOpen = false">×</button>
        </div>
        <div class="mt-2 text-sm text-slate-500">
          Adds new tasks and deliverables (skips items that already exist).
        </div>
        <ul class="mt-4 space-y-2">
          <li
            *ngFor="let tpl of availableTemplates"
            class="flex cursor-pointer items-start justify-between rounded-lg border border-slate-200 p-3 hover:border-slate-400"
            (click)="applyTemplate(tpl)"
          >
            <div>
              <div class="text-sm font-semibold text-slate-900">{{ tpl.label }}</div>
              <div class="text-xs text-slate-500">
                {{ tpl.taskCount }} tasks · {{ tpl.deliverableCount }} deliverables
              </div>
            </div>
            <span class="text-xs text-slate-500">Apply →</span>
          </li>
        </ul>
      </div>
    </div>
  `,
})
export class ProjectDetailComponent implements OnInit {
  projectId = '';
  project: ProjectItem | null = null;
  tasks: ProjectTask[] = [];
  credentials: ProjectCredential[] = [];
  availableTemplates: ProjectTemplateSummary[] = [];

  isLoading = false;
  error = '';
  activeTab: Tab = 'overview';

  descriptionDraft = '';
  projectCustomValues: Record<string, unknown> = {};
  private customValuesDirty = false;
  private customValuesSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // task form
  newTaskTitle = '';
  newTaskPriority: 'low' | 'medium' | 'high' = 'medium';
  newTaskDue = '';

  // note form
  newNoteTitle = '';
  newNoteBody = '';

  // deliverable form
  newDeliverableLabel = '';

  // credential form
  isCredFormOpen = false;
  editingCredential: ProjectCredential | null = null;
  credForm: { type: string; name: string; fields: Record<string, string>; notes?: string } = {
    type: 'ftp',
    name: '',
    fields: {},
    notes: '',
  };
  customFields: Array<{ key: string; value: string }> = [];
  isSavingCred = false;
  credError = '';
  revealedSet = new Set<string>();

  // template modal
  isTemplateModalOpen = false;

  // share panel
  shareState: SharePanelState | null = null;
  isSharing = false;

  // github
  isGithubBusy = false;
  githubError = '';

  // handover pdf
  isGeneratingPdf = false;

  readonly credentialTypes = CREDENTIAL_TYPES;

  get credFormSpec(): CredentialTypeSpec {
    return CREDENTIAL_TYPES.find((t) => t.type === this.credForm.type) ?? CREDENTIAL_TYPES[0];
  }

  get tabs() {
    return [
      { key: 'overview' as Tab, label: 'Overview' },
      { key: 'tasks' as Tab, label: 'Tasks', count: this.tasks.length },
      { key: 'notes' as Tab, label: 'Notes', count: this.project?.notes.length ?? 0 },
      { key: 'credentials' as Tab, label: 'Credentials', count: this.credentials.length },
      {
        key: 'deliverables' as Tab,
        label: 'Deliverables',
        count: this.project?.deliverables.length ?? 0,
      },
    ];
  }

  constructor(
    private readonly route: ActivatedRoute,
    private readonly projectsApi: ProjectsApiService,
    private readonly confirmDialog: ConfirmService,
    private readonly fb: FormBuilder,
  ) {}

  ngOnInit() {
    this.projectId = this.route.snapshot.params['id'];
    this.loadAll();
  }

  loadAll() {
    this.isLoading = true;
    this.error = '';
    forkJoin({
      project: this.projectsApi.findById(this.projectId),
      tasks: this.projectsApi.listTasks(this.projectId),
      credentials: this.projectsApi.listCredentials(this.projectId),
      templates: this.projectsApi.templates(),
    }).subscribe({
      next: ({ project, tasks, credentials, templates }) => {
        this.project = project;
        this.tasks = tasks;
        this.credentials = credentials;
        this.availableTemplates = templates;
        this.descriptionDraft = project.description ?? '';
        this.projectCustomValues = {
          ...((project as typeof project & { customValues?: Record<string, unknown> }).customValues ?? {}),
        };
        this.shareState = {
          shareToken: project.shareToken,
          shareCreatedAt: project.shareCreatedAt,
          shareRevokedAt: project.shareRevokedAt,
          shareViewCount: project.shareViewCount,
          shareLastViewedAt: project.shareLastViewedAt,
        };
        this.isLoading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Unable to load project';
        this.isLoading = false;
      },
    });
  }

  // ----- header actions -----
  headerActions(): ActionMenuItem[] {
    return [
      { label: 'Apply template…', action: () => (this.isTemplateModalOpen = true) },
      {
        label: 'Mark all tasks done',
        action: () => this.markAllTasksDone(),
        disabled: this.tasks.length === 0 || this.tasks.every((t) => t.status === 'done'),
      },
      {
        label: this.isGeneratingPdf ? 'Generating PDF…' : 'Download handover PDF',
        action: () => this.downloadHandover(),
        disabled: this.isGeneratingPdf,
      },
      { label: 'Refresh', action: () => this.loadAll() },
    ];
  }

  downloadHandover() {
    if (!this.project || this.isGeneratingPdf) return;
    this.isGeneratingPdf = true;
    this.projectsApi.downloadHandoverPdf(this.project._id).subscribe({
      next: (response) => {
        this.isGeneratingPdf = false;
        const blob = response.body;
        if (!blob) return;
        const filename = this.extractFilename(response.headers.get('Content-Disposition'))
          ?? `handover-${this.project?.name ?? 'project'}.pdf`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
      error: (err) => {
        this.isGeneratingPdf = false;
        this.error = err?.error?.message ?? 'Unable to generate handover PDF';
      },
    });
  }

  private extractFilename(header: string | null): string | null {
    if (!header) return null;
    const match = /filename="?([^";]+)"?/i.exec(header);
    return match ? match[1] : null;
  }

  updateStatus(status: ProjectItem['status']) {
    if (!this.project) return;
    this.projectsApi.update(this.project._id, { status }).subscribe({
      next: () => {
        this.project!.status = status;
      },
    });
  }

  onCustomValuesChange(values: Record<string, unknown>) {
    this.projectCustomValues = values;
    this.customValuesDirty = true;
    if (this.customValuesSaveTimer) clearTimeout(this.customValuesSaveTimer);
    // Debounce so quick edits don't spam the API.
    this.customValuesSaveTimer = setTimeout(() => this.persistCustomValues(), 700);
  }

  private persistCustomValues() {
    if (!this.project || !this.customValuesDirty) return;
    this.customValuesDirty = false;
    this.projectsApi
      .update(this.project._id, { customValues: this.projectCustomValues } as never)
      .subscribe({
        error: () => {
          // surface but keep the local state
          this.error = 'Unable to save custom fields';
        },
      });
  }

  saveDescription() {
    if (!this.project) return;
    if (this.descriptionDraft === (this.project.description ?? '')) return;
    this.projectsApi.update(this.project._id, { description: this.descriptionDraft }).subscribe({
      next: (p) => {
        this.project = { ...this.project!, description: p.description };
      },
    });
  }

  // ----- tasks -----
  addTask() {
    if (!this.newTaskTitle.trim()) return;
    this.projectsApi
      .createTask(this.projectId, {
        title: this.newTaskTitle.trim(),
        priority: this.newTaskPriority,
        dueDate: this.newTaskDue || undefined,
      })
      .subscribe({
        next: (task) => {
          this.tasks.push(task);
          this.newTaskTitle = '';
          this.newTaskDue = '';
        },
      });
  }

  toggleTaskDone(task: ProjectTask) {
    const next = task.status === 'done' ? 'todo' : 'done';
    this.projectsApi.updateTask(this.projectId, task._id, { status: next }).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((t) => t._id === task._id);
        if (idx >= 0) this.tasks[idx] = updated;
      },
    });
  }

  taskActions(task: ProjectTask): ActionMenuItem[] {
    return [
      {
        label: task.status === 'in_progress' ? 'Set to To do' : 'Mark in progress',
        action: () => this.setTaskStatus(task, task.status === 'in_progress' ? 'todo' : 'in_progress'),
      },
      {
        label: task.status === 'blocked' ? 'Unblock' : 'Mark blocked',
        action: () => this.setTaskStatus(task, task.status === 'blocked' ? 'todo' : 'blocked'),
      },
      { label: 'Delete', action: () => this.deleteTask(task), danger: true },
    ];
  }

  setTaskStatus(task: ProjectTask, status: ProjectTask['status']) {
    this.projectsApi.updateTask(this.projectId, task._id, { status }).subscribe({
      next: (updated) => {
        const idx = this.tasks.findIndex((t) => t._id === task._id);
        if (idx >= 0) this.tasks[idx] = updated;
      },
    });
  }

  async deleteTask(task: ProjectTask) {
    const ok = await this.confirmDialog.open({
      title: 'Delete task',
      message: `Delete "${task.title}"?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.projectsApi.deleteTask(this.projectId, task._id).subscribe({
      next: () => {
        this.tasks = this.tasks.filter((t) => t._id !== task._id);
      },
    });
  }

  markAllTasksDone() {
    this.tasks
      .filter((t) => t.status !== 'done')
      .forEach((t) => this.setTaskStatus(t, 'done'));
  }

  // ----- notes -----
  addNote() {
    if (!this.newNoteTitle.trim() || !this.newNoteBody.trim()) return;
    this.projectsApi
      .addNote(this.projectId, { title: this.newNoteTitle.trim(), body: this.newNoteBody.trim() })
      .subscribe({
        next: (project) => {
          this.project = project;
          this.newNoteTitle = '';
          this.newNoteBody = '';
        },
      });
  }

  noteActions(note: ProjectNote): ActionMenuItem[] {
    return [
      { label: 'Delete', action: () => this.deleteNote(note), danger: true },
    ];
  }

  async deleteNote(note: ProjectNote) {
    const ok = await this.confirmDialog.open({
      title: 'Delete note',
      message: 'Delete this note?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.projectsApi.deleteNote(this.projectId, note._id).subscribe({
      next: (project) => (this.project = project),
    });
  }

  // ----- deliverables -----
  addDeliverable() {
    if (!this.newDeliverableLabel.trim()) return;
    this.projectsApi
      .addDeliverable(this.projectId, { label: this.newDeliverableLabel.trim() })
      .subscribe({
        next: (project) => {
          this.project = project;
          this.newDeliverableLabel = '';
        },
      });
  }

  toggleDeliverable(item: ProjectDeliverable) {
    this.projectsApi
      .updateDeliverable(this.projectId, item._id, { done: !item.done })
      .subscribe({
        next: (project) => (this.project = project),
      });
  }

  deliverableActions(item: ProjectDeliverable): ActionMenuItem[] {
    return [
      { label: 'Delete', action: () => this.deleteDeliverable(item), danger: true },
    ];
  }

  async deleteDeliverable(item: ProjectDeliverable) {
    const ok = await this.confirmDialog.open({
      title: 'Delete deliverable',
      message: `Remove "${item.label}" from the checklist?`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.projectsApi.deleteDeliverable(this.projectId, item._id).subscribe({
      next: (project) => (this.project = project),
    });
  }

  // ----- credentials -----
  openCredentialForm(cred?: ProjectCredential) {
    this.editingCredential = cred ?? null;
    this.credError = '';
    this.customFields = [];
    if (cred) {
      this.credForm = {
        type: cred.type,
        name: cred.name,
        fields: { ...(cred.fields as Record<string, string>) },
        notes: cred.notes,
      };
      if (cred.type === 'generic') {
        this.customFields = Object.entries(cred.fields).map(([key, value]) => ({
          key,
          value: String(value ?? ''),
        }));
      }
    } else {
      this.credForm = { type: 'ftp', name: '', fields: {}, notes: '' };
    }
    this.isCredFormOpen = true;
  }

  closeCredentialForm() {
    this.isCredFormOpen = false;
    this.editingCredential = null;
    this.credError = '';
  }

  onCredTypeChange() {
    if (this.credForm.type !== 'generic') {
      const spec = this.credFormSpec;
      const next: Record<string, string> = {};
      for (const f of spec.fields) {
        next[f.key] = (this.credForm.fields?.[f.key] as string) ?? '';
      }
      this.credForm.fields = next;
    } else if (this.customFields.length === 0) {
      this.customFields = [{ key: '', value: '' }];
    }
  }

  addCustomField() {
    this.customFields.push({ key: '', value: '' });
  }
  removeCustomField(index: number) {
    this.customFields.splice(index, 1);
  }

  saveCredential() {
    if (!this.credForm.name?.trim()) {
      this.credError = 'Name is required';
      return;
    }
    let fields: Record<string, unknown>;
    if (this.credForm.type === 'generic') {
      fields = {};
      for (const kv of this.customFields) {
        const key = kv.key?.trim();
        if (key) fields[key] = kv.value ?? '';
      }
    } else {
      fields = { ...this.credForm.fields };
    }
    this.isSavingCred = true;
    this.credError = '';

    const obs = this.editingCredential
      ? this.projectsApi.updateCredential(this.projectId, this.editingCredential._id, {
          type: this.credForm.type,
          name: this.credForm.name,
          fields,
          notes: this.credForm.notes,
        })
      : this.projectsApi.createCredential(this.projectId, {
          type: this.credForm.type,
          name: this.credForm.name,
          fields,
          notes: this.credForm.notes,
        });

    obs.subscribe({
      next: () => {
        this.isSavingCred = false;
        this.closeCredentialForm();
        this.projectsApi.listCredentials(this.projectId).subscribe({
          next: (items) => (this.credentials = items),
        });
      },
      error: (err) => {
        this.isSavingCred = false;
        this.credError = err?.error?.message ?? 'Unable to save credential';
      },
    });
  }

  credentialActions(cred: ProjectCredential): ActionMenuItem[] {
    return [
      { label: 'Edit', action: () => this.openCredentialForm(cred) },
      { label: 'Delete', action: () => this.deleteCredential(cred), danger: true },
    ];
  }

  async deleteCredential(cred: ProjectCredential) {
    const ok = await this.confirmDialog.open({
      title: 'Delete credential',
      message: `Delete "${cred.name}"? This is irreversible.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.projectsApi.deleteCredential(this.projectId, cred._id).subscribe({
      next: () => {
        this.credentials = this.credentials.filter((c) => c._id !== cred._id);
      },
    });
  }

  // ----- templates -----
  applyTemplate(tpl: ProjectTemplateSummary) {
    this.isTemplateModalOpen = false;
    this.projectsApi.applyTemplate(this.projectId, tpl.key).subscribe({
      next: () => this.loadAll(),
    });
  }

  // ----- credentials helpers -----
  credentialTypeLabel(type: string) {
    return CREDENTIAL_TYPES.find((t) => t.type === type)?.label ?? type;
  }

  fieldsEntries(cred: ProjectCredential): Array<{ key: string; value: string; isSecret: boolean }> {
    const spec = CREDENTIAL_TYPES.find((t) => t.type === cred.type);
    const entries: Array<{ key: string; value: string; isSecret: boolean }> = [];
    for (const [key, value] of Object.entries(cred.fields ?? {})) {
      if (!value) continue;
      const isSecret = !!spec?.fields.find((f) => f.key === key)?.secret;
      entries.push({ key, value: String(value), isSecret });
    }
    return entries;
  }

  maskedValue(value: string, secret: boolean) {
    if (!secret) return value;
    return '•'.repeat(Math.min(12, value.length));
  }

  isRevealed(credId: string, key: string) {
    return this.revealedSet.has(`${credId}:${key}`);
  }

  toggleReveal(credId: string, key: string) {
    const id = `${credId}:${key}`;
    if (this.revealedSet.has(id)) {
      this.revealedSet.delete(id);
    } else {
      this.revealedSet.add(id);
    }
  }

  async copyToClipboard(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // ignore copy failures silently
    }
  }

  // ----- header / misc helpers -----
  clientName() {
    if (!this.project) return '';
    if (typeof this.project.clientId === 'string') return '—';
    return this.project.clientId?.name ?? '—';
  }
  serviceName() {
    if (!this.project?.serviceId) return '';
    if (typeof this.project.serviceId === 'string') return '';
    return this.project.serviceId?.name ?? '';
  }
  contractRef() {
    if (!this.project) return null;
    if (typeof this.project.contractId === 'string') return null;
    return this.project.contractId;
  }

  statusBadge(status: ProjectItem['status']) {
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

  statusLabel(status: ProjectItem['status']) {
    if (status === 'on_hold') return 'On hold';
    return status.charAt(0).toUpperCase() + status.slice(1);
  }

  doneTasks() {
    return this.tasks.filter((t) => t.status === 'done').length;
  }

  doneDeliverables() {
    return (this.project?.deliverables ?? []).filter((d) => d.done).length;
  }

  priorityBadge(p: 'low' | 'medium' | 'high') {
    if (p === 'high') return 'bg-rose-50 text-rose-700';
    if (p === 'medium') return 'bg-slate-100 text-slate-700';
    return 'bg-slate-50 text-slate-500';
  }

  formatDate(date?: string) {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  formatDateTime(date?: string) {
    if (!date) return '';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  // ----- share link -----
  generateShare() {
    if (!this.projectId) return;
    this.isSharing = true;
    this.projectsApi.generateShare(this.projectId).subscribe({
      next: (res) => {
        this.shareState = res;
        this.isSharing = false;
      },
      error: () => {
        this.isSharing = false;
        this.error = 'Unable to generate share link';
      },
    });
  }

  revokeShare() {
    if (!this.projectId || !this.shareState?.shareToken) return;
    this.isSharing = true;
    this.projectsApi.revokeShare(this.projectId).subscribe({
      next: () => {
        if (this.shareState) {
          this.shareState = { ...this.shareState, shareRevokedAt: new Date().toISOString() };
        }
        this.isSharing = false;
      },
      error: () => {
        this.isSharing = false;
        this.error = 'Unable to revoke share link';
      },
    });
  }

  // ----- github -----
  linkGithub(repoUrl: string) {
    if (!this.projectId || !this.project) return;
    this.isGithubBusy = true;
    this.githubError = '';
    this.projectsApi.linkGithub(this.projectId, repoUrl).subscribe({
      next: (repo) => {
        if (this.project) {
          this.project = {
            ...this.project,
            githubRepo: { ...repo, linkedAt: repo.linkedAt },
          };
        }
        this.isGithubBusy = false;
      },
      error: (err) => {
        this.isGithubBusy = false;
        this.githubError = err?.error?.message ?? 'Unable to link repo';
      },
    });
  }

  unlinkGithub() {
    if (!this.projectId || !this.project) return;
    this.isGithubBusy = true;
    this.githubError = '';
    this.projectsApi.unlinkGithub(this.projectId).subscribe({
      next: () => {
        if (this.project) {
          this.project = { ...this.project, githubRepo: undefined };
        }
        this.isGithubBusy = false;
      },
      error: () => {
        this.isGithubBusy = false;
        this.githubError = 'Unable to unlink repo';
      },
    });
  }
}
