import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectsApiService } from '../../core/services/projects-api.service';
import { ProjectTask } from '../../core/models/project.model';

@Component({
  selector: 'app-task-detail',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <ng-container *ngIf="task">
      <!-- Backdrop -->
      <div
        class="fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm"
        (click)="emitClose()"
      ></div>

      <!-- Slide-over -->
      <aside
        class="fixed right-0 top-0 z-50 flex h-screen w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <!-- Header -->
        <header class="flex items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div class="min-w-0 flex-1">
            <input
              [(ngModel)]="titleDraft"
              (blur)="saveTitle()"
              (keyup.enter)="saveTitle()"
              class="w-full bg-transparent text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 rounded px-1 -mx-1"
              [placeholder]="'Untitled task'"
            />
            <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span class="rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
                [ngClass]="statusBadgeClass(task.status)">
                {{ statusLabel(task.status) }}
              </span>
              <span>·</span>
              <span>Created {{ formatDate(task.createdAt) }}</span>
              <span *ngIf="task.completedAt"> · Completed {{ formatDate(task.completedAt) }}</span>
            </div>
          </div>
          <button
            type="button"
            (click)="emitClose()"
            class="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <!-- Status / Priority / Dates -->
          <section>
            <h3 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Details</h3>
            <div class="mt-2 grid grid-cols-2 gap-3 text-sm">
              <label class="block">
                <span class="text-[11px] uppercase tracking-wide text-slate-500">Status</span>
                <select
                  [ngModel]="task.status"
                  (ngModelChange)="updateField('status', $event)"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                >
                  <option value="todo">To do</option>
                  <option value="in_progress">Doing</option>
                  <option value="blocked">Blocked</option>
                  <option value="done">Done</option>
                </select>
              </label>
              <label class="block">
                <span class="text-[11px] uppercase tracking-wide text-slate-500">Priority</span>
                <select
                  [ngModel]="task.priority"
                  (ngModelChange)="updateField('priority', $event)"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </label>
              <label class="block">
                <span class="text-[11px] uppercase tracking-wide text-slate-500">Start date</span>
                <input
                  type="date"
                  [ngModel]="toDateInput(task.startDate)"
                  (ngModelChange)="updateField('startDate', $event)"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
              </label>
              <label class="block">
                <span class="text-[11px] uppercase tracking-wide text-slate-500">Due date</span>
                <input
                  type="date"
                  [ngModel]="toDateInput(task.dueDate)"
                  (ngModelChange)="updateField('dueDate', $event)"
                  class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                />
              </label>
            </div>
          </section>

          <!-- Tags -->
          <section>
            <h3 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Tags</h3>
            <div class="mt-2 flex flex-wrap items-center gap-1.5">
              <span
                *ngFor="let tag of task.tags"
                class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
              >
                {{ tag }}
                <button
                  type="button"
                  (click)="removeTag(tag)"
                  class="text-slate-400 hover:text-rose-600"
                  aria-label="Remove tag"
                >×</button>
              </span>
              <input
                [(ngModel)]="newTag"
                (keyup.enter)="addTag()"
                (blur)="addTag()"
                placeholder="+ Add tag"
                class="rounded border border-dashed border-slate-300 bg-transparent px-2 py-0.5 text-xs focus:border-slate-500 focus:outline-none"
              />
            </div>
          </section>

          <!-- Description -->
          <section>
            <h3 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">Description</h3>
            <textarea
              [(ngModel)]="descriptionDraft"
              (blur)="saveDescription()"
              rows="4"
              placeholder="Add a more detailed description…"
              class="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            ></textarea>
          </section>

          <!-- Checklist -->
          <section>
            <div class="flex items-center justify-between">
              <h3 class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Checklist
                <span *ngIf="task.checklist.length > 0" class="ml-1 normal-case tracking-normal text-slate-400">
                  ({{ doneChecklistCount() }} / {{ task.checklist.length }})
                </span>
              </h3>
            </div>
            <!-- Progress bar -->
            <div *ngIf="task.checklist.length > 0" class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
              <div class="h-full bg-emerald-500 transition-all" [style.width.%]="checklistPercent()"></div>
            </div>
            <ul class="mt-3 space-y-1.5">
              <li
                *ngFor="let item of task.checklist; trackBy: trackById"
                class="group flex items-start gap-2 rounded px-1.5 py-1 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  [checked]="item.done"
                  (change)="toggleChecklist(item._id, !item.done)"
                  class="mt-1 h-4 w-4 rounded border-slate-300"
                />
                <span class="flex-1 text-sm" [ngClass]="item.done ? 'text-slate-400 line-through' : 'text-slate-800'">
                  {{ item.text }}
                </span>
                <button
                  type="button"
                  (click)="removeChecklist(item._id)"
                  class="opacity-0 transition group-hover:opacity-100 text-slate-400 hover:text-rose-600"
                  aria-label="Remove item"
                >
                  <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </li>
            </ul>
            <div class="mt-2 flex items-center gap-2">
              <input
                [(ngModel)]="newChecklistText"
                (keyup.enter)="addChecklist()"
                placeholder="Add an item…"
                class="flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              />
              <button
                type="button"
                (click)="addChecklist()"
                [disabled]="!newChecklistText.trim()"
                class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </section>
        </div>

        <!-- Footer -->
        <footer class="flex items-center justify-between border-t border-slate-200 px-5 py-3">
          <button
            type="button"
            (click)="emitDelete()"
            class="text-xs font-semibold uppercase tracking-wide text-rose-600 hover:text-rose-800"
          >
            Delete task
          </button>
          <span *ngIf="saving" class="text-xs text-slate-400">Saving…</span>
          <span *ngIf="!saving && saved" class="text-xs text-emerald-600">Saved</span>
        </footer>
      </aside>
    </ng-container>
  `,
})
export class TaskDetailComponent implements OnChanges {
  @Input() projectId = '';
  @Input() task: ProjectTask | null = null;

  @Output() close = new EventEmitter<void>();
  @Output() taskChanged = new EventEmitter<ProjectTask>();
  @Output() deleteTask = new EventEmitter<ProjectTask>();

  titleDraft = '';
  descriptionDraft = '';
  newTag = '';
  newChecklistText = '';
  saving = false;
  saved = false;
  private savedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly projectsApi: ProjectsApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['task'] && this.task) {
      this.titleDraft = this.task.title;
      this.descriptionDraft = this.task.description ?? '';
    }
  }

  emitClose() {
    this.close.emit();
  }

  emitDelete() {
    if (this.task) this.deleteTask.emit(this.task);
  }

  saveTitle() {
    if (!this.task) return;
    const next = this.titleDraft.trim();
    if (!next || next === this.task.title) return;
    this.updateField('title', next);
  }

  saveDescription() {
    if (!this.task) return;
    if ((this.descriptionDraft ?? '') === (this.task.description ?? '')) return;
    this.updateField('description', this.descriptionDraft);
  }

  updateField(field: keyof ProjectTask, value: unknown) {
    if (!this.task || !this.projectId) return;
    const payload: Record<string, unknown> = { [field]: value };
    if (field === 'startDate' || field === 'dueDate') {
      payload[field as string] = value || null;
    }
    this.saveState();
    this.projectsApi.updateTask(this.projectId, this.task._id, payload as never).subscribe({
      next: (updated) => {
        this.task = { ...(this.task as ProjectTask), ...updated };
        this.taskChanged.emit(this.task);
        this.flashSaved();
      },
      error: () => {
        this.saving = false;
      },
    });
  }

  addTag() {
    if (!this.task) return;
    const tag = this.newTag.trim().toLowerCase();
    if (!tag) return;
    if (this.task.tags.includes(tag)) {
      this.newTag = '';
      return;
    }
    const nextTags = [...this.task.tags, tag].slice(0, 20);
    this.newTag = '';
    this.updateField('tags', nextTags);
  }

  removeTag(tag: string) {
    if (!this.task) return;
    const nextTags = this.task.tags.filter((t) => t !== tag);
    this.updateField('tags', nextTags);
  }

  addChecklist() {
    if (!this.task || !this.projectId) return;
    const text = this.newChecklistText.trim();
    if (!text) return;
    this.newChecklistText = '';
    this.saveState();
    this.projectsApi.addChecklistItem(this.projectId, this.task._id, text).subscribe({
      next: (updated) => {
        this.task = updated;
        this.taskChanged.emit(updated);
        this.flashSaved();
      },
      error: () => (this.saving = false),
    });
  }

  toggleChecklist(itemId: string, done: boolean) {
    if (!this.task || !this.projectId) return;
    this.saveState();
    this.projectsApi
      .updateChecklistItem(this.projectId, this.task._id, itemId, { done })
      .subscribe({
        next: (updated) => {
          this.task = updated;
          this.taskChanged.emit(updated);
          this.flashSaved();
        },
        error: () => (this.saving = false),
      });
  }

  removeChecklist(itemId: string) {
    if (!this.task || !this.projectId) return;
    this.saveState();
    this.projectsApi.deleteChecklistItem(this.projectId, this.task._id, itemId).subscribe({
      next: (updated) => {
        this.task = updated;
        this.taskChanged.emit(updated);
        this.flashSaved();
      },
      error: () => (this.saving = false),
    });
  }

  doneChecklistCount(): number {
    return this.task ? this.task.checklist.filter((c) => c.done).length : 0;
  }

  checklistPercent(): number {
    if (!this.task || this.task.checklist.length === 0) return 0;
    return (this.doneChecklistCount() / this.task.checklist.length) * 100;
  }

  statusLabel(s: string) {
    if (s === 'todo') return 'To do';
    if (s === 'in_progress') return 'Doing';
    if (s === 'blocked') return 'Blocked';
    if (s === 'done') return 'Done';
    return s;
  }

  statusBadgeClass(s: string) {
    switch (s) {
      case 'in_progress':
        return 'bg-blue-100 text-blue-700';
      case 'blocked':
        return 'bg-amber-100 text-amber-700';
      case 'done':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-slate-100 text-slate-700';
    }
  }

  toDateInput(value?: string) {
    if (!value) return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  formatDate(value?: string) {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  trackById(_i: number, item: { _id: string }) {
    return item._id;
  }

  private saveState() {
    this.saving = true;
    this.saved = false;
  }

  private flashSaved() {
    this.saving = false;
    this.saved = true;
    if (this.savedTimer) clearTimeout(this.savedTimer);
    this.savedTimer = setTimeout(() => (this.saved = false), 1500);
  }
}
