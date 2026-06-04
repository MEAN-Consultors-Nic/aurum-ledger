import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProjectsApiService, GithubActivityResponse } from '../../core/services/projects-api.service';

export type GithubRepoLink = {
  owner: string;
  name: string;
  htmlUrl: string;
  linkedAt?: string;
  createdAt?: string;
};

@Component({
  selector: 'app-github-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div class="flex items-center gap-2">
          <svg class="h-5 w-5 text-slate-700" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <div>
            <div class="text-sm font-semibold text-slate-900">GitHub repo</div>
            <div class="text-xs text-slate-500">
              <ng-container *ngIf="!repo">Link an existing repo or auto-create one on contract conversion.</ng-container>
              <ng-container *ngIf="repo">
                <a [href]="repo.htmlUrl" target="_blank" rel="noopener" class="font-mono text-slate-700 hover:underline">
                  {{ repo.owner }}/{{ repo.name }}
                </a>
                <span *ngIf="activity?.visibility" class="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                  {{ activity?.visibility }}
                </span>
              </ng-container>
            </div>
          </div>
        </div>
        <button
          *ngIf="repo"
          type="button"
          (click)="emitUnlink()"
          [disabled]="busy"
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50 disabled:opacity-40"
        >
          Unlink
        </button>
      </header>

      <!-- Not linked: link form -->
      <div *ngIf="!repo" class="space-y-3 px-5 py-4">
        <div>
          <label class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Repository URL
          </label>
          <div class="mt-1 flex items-center gap-2">
            <input
              type="text"
              [(ngModel)]="repoUrlInput"
              placeholder="https://github.com/owner/repo  or  owner/repo"
              class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
              (keyup.enter)="emitLink()"
            />
            <button
              type="button"
              (click)="emitLink()"
              [disabled]="!repoUrlInput.trim() || busy"
              class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
            >
              {{ busy ? 'Linking…' : 'Link repo' }}
            </button>
          </div>
        </div>
        <div *ngIf="linkError" class="text-xs text-rose-600">{{ linkError }}</div>
      </div>

      <!-- Linked: activity -->
      <div *ngIf="repo" class="px-5 py-4">
        <div *ngIf="isLoading" class="text-xs text-slate-500">Loading activity…</div>

        <div *ngIf="!isLoading && activityError"
          class="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
          {{ activityError }}
          <button type="button" (click)="emitReload()" class="ml-2 underline">Retry</button>
        </div>

        <div *ngIf="!isLoading && !activityError && activity" class="space-y-4">
          <!-- Commits -->
          <div>
            <div class="flex items-center justify-between">
              <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Recent commits
                <span *ngIf="activity.defaultBranch" class="font-mono text-slate-400">
                  · {{ activity.defaultBranch }}
                </span>
              </div>
              <button type="button" (click)="emitReload()" [disabled]="busy"
                class="text-[11px] uppercase tracking-wide text-slate-500 hover:text-slate-900 disabled:opacity-40">
                Refresh
              </button>
            </div>
            <ul *ngIf="activity.commits.length > 0" class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              <li *ngFor="let c of activity.commits" class="flex items-start gap-3 px-3 py-2">
                <img *ngIf="c.authorAvatar" [src]="c.authorAvatar" alt=""
                  class="mt-0.5 h-6 w-6 shrink-0 rounded-full" loading="lazy" />
                <span *ngIf="!c.authorAvatar"
                  class="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-500">
                  {{ initial(c.authorName) }}
                </span>
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm text-slate-900">{{ c.message }}</div>
                  <div class="text-[11px] text-slate-500">
                    {{ c.authorName }} · {{ formatRelative(c.date) }} ·
                    <a [href]="c.url" target="_blank" rel="noopener" class="font-mono text-slate-600 hover:underline">{{ c.shortSha }}</a>
                  </div>
                </div>
              </li>
            </ul>
            <div *ngIf="activity.commits.length === 0" class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              No commits yet.
            </div>
          </div>

          <!-- Open PRs -->
          <div>
            <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Open pull requests ({{ activity.pullRequests.length }})
            </div>
            <ul *ngIf="activity.pullRequests.length > 0" class="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
              <li *ngFor="let pr of activity.pullRequests" class="flex items-start gap-3 px-3 py-2">
                <span class="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  [ngClass]="pr.draft ? 'bg-slate-300' : 'bg-emerald-500'"></span>
                <div class="min-w-0 flex-1">
                  <a [href]="pr.url" target="_blank" rel="noopener"
                    class="block truncate text-sm text-slate-900 hover:underline">
                    #{{ pr.number }} {{ pr.title }}
                  </a>
                  <div class="text-[11px] text-slate-500">
                    by {{ pr.authorName }} · updated {{ formatRelative(pr.updatedAt) }}
                    <span *ngIf="pr.draft" class="ml-1 text-slate-400">· draft</span>
                  </div>
                </div>
              </li>
            </ul>
            <div *ngIf="activity.pullRequests.length === 0" class="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
              No open pull requests.
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
})
export class GithubPanelComponent implements OnChanges {
  @Input() projectId = '';
  @Input() repo: GithubRepoLink | null | undefined = null;
  @Input() busy = false;
  @Input() linkError = '';

  @Output() link = new EventEmitter<string>();
  @Output() unlink = new EventEmitter<void>();

  repoUrlInput = '';
  isLoading = false;
  activityError = '';
  activity: GithubActivityResponse | null = null;

  constructor(private readonly projectsApi: ProjectsApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['repo'] && this.repo && this.projectId) {
      this.loadActivity();
    }
    if (changes['repo'] && !this.repo) {
      this.activity = null;
      this.activityError = '';
    }
  }

  emitLink() {
    const value = this.repoUrlInput.trim();
    if (!value) return;
    this.link.emit(value);
    this.repoUrlInput = '';
  }

  emitUnlink() {
    this.unlink.emit();
  }

  emitReload() {
    this.loadActivity();
  }

  private loadActivity() {
    if (!this.projectId) return;
    this.isLoading = true;
    this.activityError = '';
    this.projectsApi.githubActivity(this.projectId).subscribe({
      next: (data) => {
        this.activity = data;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.activityError = err?.error?.message ?? 'Unable to load GitHub activity';
      },
    });
  }

  initial(name?: string): string {
    return (name || '?').charAt(0).toUpperCase();
  }

  formatRelative(value?: string): string {
    if (!value) return '';
    const date = new Date(value);
    const diffMs = Date.now() - date.getTime();
    const sec = Math.floor(diffMs / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
}
