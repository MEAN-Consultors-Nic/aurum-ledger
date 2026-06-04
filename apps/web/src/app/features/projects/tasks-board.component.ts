import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  CdkDrag,
  CdkDragDrop,
  CdkDropList,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { ProjectsApiService } from '../../core/services/projects-api.service';
import { ProjectTask } from '../../core/models/project.model';
import { TaskDetailComponent } from './task-detail.component';

type Column = {
  key: 'todo' | 'in_progress' | 'blocked' | 'done';
  label: string;
  accent: string;
};

const COLUMNS: Column[] = [
  { key: 'todo', label: 'To do', accent: 'bg-slate-400' },
  { key: 'in_progress', label: 'Doing', accent: 'bg-blue-500' },
  { key: 'blocked', label: 'Blocked', accent: 'bg-amber-500' },
  { key: 'done', label: 'Done', accent: 'bg-emerald-500' },
];

@Component({
  selector: 'app-tasks-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    CdkDropList,
    CdkDrag,
    TaskDetailComponent,
  ],
  template: `
    <div class="space-y-4">
      <!-- Quick add -->
      <div class="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div class="flex flex-wrap items-center gap-2">
          <input
            [(ngModel)]="quickTitle"
            (keyup.enter)="quickAdd()"
            placeholder="Add a task — press enter…"
            class="flex-1 min-w-[12rem] rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
          <select
            [(ngModel)]="quickStatus"
            class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs uppercase tracking-wide text-slate-600"
          >
            <option *ngFor="let col of columns" [value]="col.key">{{ col.label }}</option>
          </select>
          <select
            [(ngModel)]="quickPriority"
            class="rounded-lg border border-slate-200 px-2.5 py-2 text-xs uppercase tracking-wide text-slate-600"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          <button
            type="button"
            (click)="quickAdd()"
            [disabled]="!quickTitle.trim() || isAdding"
            class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-40"
          >
            {{ isAdding ? 'Adding…' : '+ Add task' }}
          </button>
        </div>
      </div>

      <!-- Board -->
      <div class="grid grid-cols-1 gap-3 lg:grid-cols-4">
        <div
          *ngFor="let col of columns"
          class="flex flex-col rounded-xl bg-slate-100/70 p-2"
        >
          <header class="flex items-center justify-between px-2 py-1.5">
            <div class="flex items-center gap-2">
              <span class="inline-block h-2 w-2 rounded-full" [ngClass]="col.accent"></span>
              <span class="text-xs font-semibold uppercase tracking-[0.15em] text-slate-600">
                {{ col.label }}
              </span>
              <span class="rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-slate-500">
                {{ buckets[col.key].length }}
              </span>
            </div>
          </header>

          <div
            cdkDropList
            [id]="col.key"
            [cdkDropListData]="buckets[col.key]"
            [cdkDropListConnectedTo]="otherColumnIds(col.key)"
            (cdkDropListDropped)="onDrop($event)"
            class="flex min-h-[60px] flex-1 flex-col gap-2 px-1 py-1"
          >
            <article
              *ngFor="let task of buckets[col.key]; trackBy: trackById"
              cdkDrag
              [cdkDragData]="task"
              (cdkDragStarted)="onDragStarted()"
              (cdkDragEnded)="onDragEnded()"
              (click)="open(task)"
              class="cursor-pointer rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow"
            >
              <!-- Tags -->
              <div *ngIf="task.tags?.length" class="flex flex-wrap gap-1">
                <span
                  *ngFor="let tag of task.tags.slice(0, 3)"
                  class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                  [ngClass]="tagColor(tag)"
                >
                  {{ tag }}
                </span>
                <span
                  *ngIf="task.tags.length > 3"
                  class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500"
                >
                  +{{ task.tags.length - 3 }}
                </span>
              </div>

              <!-- Title -->
              <div class="mt-1.5 text-sm font-medium text-slate-900">{{ task.title }}</div>

              <!-- Description preview -->
              <div *ngIf="task.description" class="mt-0.5 line-clamp-2 text-xs text-slate-500">
                {{ task.description }}
              </div>

              <!-- Footer: priority, due, checklist, assignee -->
              <div class="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span class="rounded px-1.5 py-0.5 font-semibold uppercase tracking-wide" [ngClass]="priorityColor(task.priority)">
                  {{ task.priority }}
                </span>
                <span
                  *ngIf="task.dueDate"
                  class="inline-flex items-center gap-1 rounded px-1.5 py-0.5"
                  [ngClass]="dueDateColor(task)"
                >
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>
                  </svg>
                  {{ formatDate(task.dueDate) }}
                </span>
                <span
                  *ngIf="task.checklist?.length"
                  class="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-slate-600"
                  [ngClass]="checklistDone(task)"
                >
                  <svg class="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                  </svg>
                  {{ doneCount(task) }}/{{ task.checklist.length }}
                </span>
                <span class="flex-1"></span>
                <span
                  *ngIf="assigneeInitial(task)"
                  class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-700"
                  [title]="assigneeName(task)"
                >
                  {{ assigneeInitial(task) }}
                </span>
              </div>
            </article>

            <!-- Empty column placeholder -->
            <div *ngIf="buckets[col.key].length === 0"
              class="rounded-lg border-2 border-dashed border-slate-200 bg-white/30 px-3 py-4 text-center text-[11px] text-slate-400">
              Drop tasks here
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Detail slide-over -->
    <app-task-detail
      [projectId]="projectId"
      [task]="selectedTask"
      (close)="close()"
      (taskChanged)="onTaskChanged($event)"
      (deleteTask)="onDeleteTask($event)"
    />
  `,
  styles: [
    `
      :host ::ng-deep .cdk-drag-preview {
        box-shadow: 0 8px 24px rgba(15, 23, 42, 0.15);
        border-radius: 0.5rem;
        opacity: 0.95;
      }
      :host ::ng-deep .cdk-drag-placeholder {
        opacity: 0;
      }
      :host ::ng-deep .cdk-drop-list-dragging .cdk-drag {
        transition: transform 250ms cubic-bezier(0, 0, 0.2, 1);
      }
    `,
  ],
})
export class TasksBoardComponent implements OnChanges {
  @Input() projectId = '';
  @Input() tasks: ProjectTask[] = [];

  readonly columns = COLUMNS;
  buckets: Record<Column['key'], ProjectTask[]> = {
    todo: [],
    in_progress: [],
    blocked: [],
    done: [],
  };

  // Quick-add form
  quickTitle = '';
  quickStatus: Column['key'] = 'todo';
  quickPriority: 'low' | 'medium' | 'high' = 'medium';
  isAdding = false;

  // Slide-over
  selectedTask: ProjectTask | null = null;

  // Drag-vs-click discriminator. CDK still bubbles the click after a drag,
  // so we suppress the next click for a short window after a real drag.
  private suppressClickUntil = 0;

  constructor(private readonly projectsApi: ProjectsApiService) {}

  onDragStarted() {
    this.suppressClickUntil = Date.now() + 300;
  }

  onDragEnded() {
    // Extend the window so the click event fired right after release is
    // still suppressed.
    this.suppressClickUntil = Date.now() + 300;
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['tasks']) {
      this.rebuildBuckets();
    }
  }

  private rebuildBuckets() {
    const next: Record<Column['key'], ProjectTask[]> = {
      todo: [],
      in_progress: [],
      blocked: [],
      done: [],
    };
    for (const t of this.tasks ?? []) {
      (next[t.status] ?? next.todo).push(t);
    }
    for (const key of Object.keys(next) as Column['key'][]) {
      next[key].sort((a, b) => a.order - b.order);
    }
    this.buckets = next;
  }

  otherColumnIds(current: Column['key']): string[] {
    return this.columns.map((c) => c.key).filter((k) => k !== current);
  }

  onDrop(event: CdkDragDrop<ProjectTask[]>) {
    const fromCol = event.previousContainer.id as Column['key'];
    const toCol = event.container.id as Column['key'];
    if (fromCol === toCol && event.previousIndex === event.currentIndex) return;

    if (fromCol === toCol) {
      moveItemInArray(this.buckets[toCol], event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        this.buckets[fromCol],
        this.buckets[toCol],
        event.previousIndex,
        event.currentIndex,
      );
    }

    const moved = this.buckets[toCol][event.currentIndex];
    if (!moved) return;
    moved.status = toCol;

    this.projectsApi
      .moveTask(this.projectId, moved._id, { status: toCol, order: event.currentIndex })
      .subscribe({
        next: () => {
          // Re-number locally so dragging the next task feels right immediately.
          this.buckets[toCol].forEach((t, idx) => (t.order = idx));
          if (fromCol !== toCol) {
            this.buckets[fromCol].forEach((t, idx) => (t.order = idx));
          }
        },
        error: () => {
          // On failure, restore by reading the original tasks. Cheap & safe.
          this.rebuildBuckets();
        },
      });
  }

  quickAdd() {
    const title = this.quickTitle.trim();
    if (!title || this.isAdding) return;
    this.isAdding = true;
    this.projectsApi
      .createTask(this.projectId, {
        title,
        status: this.quickStatus,
        priority: this.quickPriority,
      })
      .subscribe({
        next: (task) => {
          this.buckets[this.quickStatus].push(task);
          this.quickTitle = '';
          this.isAdding = false;
        },
        error: () => {
          this.isAdding = false;
        },
      });
  }

  open(task: ProjectTask) {
    if (Date.now() < this.suppressClickUntil) return;
    this.selectedTask = task;
  }

  close() {
    this.selectedTask = null;
  }

  onTaskChanged(updated: ProjectTask) {
    // Update the task in-place inside its bucket. If status changed, move it.
    const prev = this.findInBuckets(updated._id);
    if (!prev) return;
    if (prev.col !== updated.status) {
      this.buckets[prev.col].splice(prev.idx, 1);
      this.buckets[updated.status].push(updated);
    } else {
      this.buckets[prev.col][prev.idx] = updated;
    }
    this.selectedTask = updated;
  }

  onDeleteTask(task: ProjectTask) {
    if (!confirm('Delete this task?')) return;
    this.projectsApi.deleteTask(this.projectId, task._id).subscribe({
      next: () => {
        const found = this.findInBuckets(task._id);
        if (found) {
          this.buckets[found.col].splice(found.idx, 1);
        }
        this.selectedTask = null;
      },
    });
  }

  private findInBuckets(taskId: string): { col: Column['key']; idx: number } | null {
    for (const key of Object.keys(this.buckets) as Column['key'][]) {
      const idx = this.buckets[key].findIndex((t) => t._id === taskId);
      if (idx !== -1) return { col: key, idx };
    }
    return null;
  }

  // ----- visual helpers -----

  priorityColor(p: string) {
    if (p === 'high') return 'bg-rose-100 text-rose-700';
    if (p === 'medium') return 'bg-slate-200 text-slate-700';
    return 'bg-slate-100 text-slate-500';
  }

  tagColor(tag: string) {
    // Stable hash → color from a small palette
    const palette = [
      'bg-violet-100 text-violet-700',
      'bg-sky-100 text-sky-700',
      'bg-emerald-100 text-emerald-700',
      'bg-amber-100 text-amber-700',
      'bg-rose-100 text-rose-700',
      'bg-cyan-100 text-cyan-700',
    ];
    let h = 0;
    for (let i = 0; i < tag.length; i++) {
      h = (h * 31 + tag.charCodeAt(i)) | 0;
    }
    return palette[Math.abs(h) % palette.length];
  }

  dueDateColor(task: ProjectTask) {
    if (!task.dueDate) return 'bg-slate-100 text-slate-600';
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (task.status === 'done') return 'bg-slate-100 text-slate-400 line-through';
    if (due < today) return 'bg-rose-100 text-rose-700';
    const diff = (due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    if (diff <= 2) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-600';
  }

  checklistDone(task: ProjectTask) {
    if (!task.checklist?.length) return '';
    const done = this.doneCount(task);
    return done === task.checklist.length ? 'bg-emerald-100 !text-emerald-700' : '';
  }

  doneCount(task: ProjectTask): number {
    return task.checklist?.filter((c) => c.done).length ?? 0;
  }

  assigneeInitial(task: ProjectTask): string {
    if (!task.assignedTo) return '';
    if (typeof task.assignedTo === 'string') return '·';
    return (task.assignedTo.name || '?').charAt(0).toUpperCase();
  }

  assigneeName(task: ProjectTask): string {
    if (!task.assignedTo) return '';
    if (typeof task.assignedTo === 'string') return '';
    return task.assignedTo.name;
  }

  formatDate(value?: string): string {
    if (!value) return '';
    return new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  trackById(_i: number, item: ProjectTask) {
    return item._id;
  }
}
