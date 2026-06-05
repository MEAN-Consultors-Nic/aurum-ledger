import {
  AfterViewInit,
  Component,
  ElementRef,
  HostListener,
  OnDestroy,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';
import {
  SearchApiService,
  SearchResult,
  SearchResultType,
} from '../../core/services/search-api.service';

type TypeMeta = { label: string; chip: string; iconBg: string; iconColor: string };

const TYPE_META: Record<SearchResultType, TypeMeta> = {
  client: { label: 'Client', chip: 'bg-amber-100 text-amber-700', iconBg: 'bg-amber-50', iconColor: 'text-amber-600' },
  estimate: { label: 'Estimate', chip: 'bg-blue-100 text-blue-700', iconBg: 'bg-blue-50', iconColor: 'text-blue-600' },
  contract: { label: 'Contract', chip: 'bg-indigo-100 text-indigo-700', iconBg: 'bg-indigo-50', iconColor: 'text-indigo-600' },
  project: { label: 'Project', chip: 'bg-emerald-100 text-emerald-700', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
  task: { label: 'Task', chip: 'bg-violet-100 text-violet-700', iconBg: 'bg-violet-50', iconColor: 'text-violet-600' },
  service: { label: 'Service', chip: 'bg-cyan-100 text-cyan-700', iconBg: 'bg-cyan-50', iconColor: 'text-cyan-600' },
};

@Component({
  selector: 'app-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Backdrop -->
    <div
      *ngIf="isOpen"
      class="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm"
      (click)="close()"
    ></div>

    <!-- Palette -->
    <div
      *ngIf="isOpen"
      class="fixed left-1/2 top-[16vh] z-[101] w-[92%] max-w-2xl -translate-x-1/2"
      role="dialog"
      aria-modal="true"
    >
      <div class="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl ring-1 ring-black/5">
        <!-- Search input -->
        <div class="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <svg class="h-5 w-5 shrink-0 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            #queryInput
            type="text"
            [(ngModel)]="query"
            (ngModelChange)="onQueryChange($event)"
            placeholder="Search clients, estimates, contracts, projects, tasks…"
            class="flex-1 bg-transparent text-base text-slate-900 placeholder-slate-400 focus:outline-none"
            autocomplete="off"
            spellcheck="false"
          />
          <span class="rounded-md border border-slate-200 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            esc
          </span>
        </div>

        <!-- Loading -->
        <div *ngIf="isLoading" class="px-4 py-6 text-center text-xs text-slate-400">
          Searching…
        </div>

        <!-- Empty state: no query yet -->
        <div *ngIf="!isLoading && query.trim().length < 2" class="px-4 py-8 text-center">
          <div class="text-sm text-slate-500">
            Start typing to search across the whole platform.
          </div>
          <div class="mt-2 text-[11px] text-slate-400">
            Clients · Estimates · Contracts · Projects · Tasks · Services
          </div>
        </div>

        <!-- Empty results -->
        <div
          *ngIf="!isLoading && query.trim().length >= 2 && results.length === 0"
          class="px-4 py-8 text-center text-sm text-slate-500"
        >
          No matches for <span class="font-mono">"{{ query }}"</span>.
        </div>

        <!-- Results -->
        <ul *ngIf="!isLoading && results.length > 0" class="max-h-[60vh] overflow-y-auto py-1">
          <li
            *ngFor="let r of results; let i = index"
            (click)="select(i)"
            (mouseenter)="highlightedIndex = i"
            class="flex cursor-pointer items-center gap-3 px-3 py-2.5 transition"
            [ngClass]="i === highlightedIndex ? 'bg-slate-100' : 'hover:bg-slate-50'"
          >
            <!-- Icon -->
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              [ngClass]="meta(r.type).iconBg">
              <ng-container [ngSwitch]="r.type">
                <svg *ngSwitchCase="'client'" class="h-4 w-4" [ngClass]="meta(r.type).iconColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
                <svg *ngSwitchCase="'estimate'" class="h-4 w-4" [ngClass]="meta(r.type).iconColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M8 13h8"/>
                  <path d="M8 17h5"/>
                </svg>
                <svg *ngSwitchCase="'contract'" class="h-4 w-4" [ngClass]="meta(r.type).iconColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="8" y="2" width="8" height="4" rx="1"/>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                  <path d="m9 14 2 2 4-4"/>
                </svg>
                <svg *ngSwitchCase="'project'" class="h-4 w-4" [ngClass]="meta(r.type).iconColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                </svg>
                <svg *ngSwitchCase="'task'" class="h-4 w-4" [ngClass]="meta(r.type).iconColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="9 11 12 14 22 4"/>
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
                </svg>
                <svg *ngSwitchCase="'service'" class="h-4 w-4" [ngClass]="meta(r.type).iconColor" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21 16-9 5-9-5V8l9-5 9 5z"/>
                  <path d="m3.3 7 8.7 5 8.7-5"/>
                  <path d="M12 22V12"/>
                </svg>
              </ng-container>
            </div>

            <!-- Label + subtitle -->
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-medium text-slate-900">{{ r.label }}</div>
              <div class="truncate text-[11px] text-slate-500">{{ r.subtitle }}</div>
            </div>

            <!-- Type chip -->
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              [ngClass]="meta(r.type).chip"
            >
              {{ meta(r.type).label }}
            </span>
          </li>
        </ul>

        <!-- Hint bar -->
        <div class="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-2 text-[10px] text-slate-500">
          <div class="flex items-center gap-3">
            <span class="flex items-center gap-1">
              <kbd class="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">↑</kbd>
              <kbd class="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">↓</kbd>
              navigate
            </span>
            <span class="flex items-center gap-1">
              <kbd class="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">↵</kbd>
              select
            </span>
            <span class="flex items-center gap-1">
              <kbd class="rounded border border-slate-200 bg-white px-1 font-mono text-[10px]">esc</kbd>
              close
            </span>
          </div>
          <div *ngIf="results.length > 0" class="tabular-nums">
            {{ results.length }} result{{ results.length === 1 ? '' : 's' }}
          </div>
        </div>
      </div>
    </div>
  `,
})
export class CommandPaletteComponent implements AfterViewInit, OnDestroy {
  @ViewChild('queryInput') queryInput?: ElementRef<HTMLInputElement>;

  isOpen = false;
  query = '';
  results: SearchResult[] = [];
  highlightedIndex = 0;
  isLoading = false;

  private readonly queryStream = new Subject<string>();
  private readonly subs: Subscription[] = [];

  constructor(
    private readonly searchApi: SearchApiService,
    private readonly router: Router,
  ) {
    this.subs.push(
      this.queryStream
        .pipe(
          debounceTime(180),
          distinctUntilChanged(),
          switchMap((q) => {
            if (q.trim().length < 2) {
              this.results = [];
              this.isLoading = false;
              this.highlightedIndex = 0;
              return [];
            }
            this.isLoading = true;
            return this.searchApi.search(q);
          }),
        )
        .subscribe({
          next: (res) => {
            this.results = res.results ?? [];
            this.highlightedIndex = 0;
            this.isLoading = false;
          },
          error: () => {
            this.isLoading = false;
          },
        }),
    );
  }

  ngAfterViewInit() {
    // No-op; we focus on open() via setTimeout so the input exists by then.
  }

  ngOnDestroy() {
    this.subs.forEach((s) => s.unsubscribe());
    this.queryStream.complete();
  }

  @HostListener('document:keydown', ['$event'])
  onGlobalKey(event: KeyboardEvent) {
    const isToggle =
      (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
    if (isToggle) {
      event.preventDefault();
      this.toggle();
      return;
    }
    if (!this.isOpen) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      this.move(1);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      this.move(-1);
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      if (this.results[this.highlightedIndex]) {
        this.select(this.highlightedIndex);
      }
    }
  }

  toggle() {
    this.isOpen ? this.close() : this.open();
  }

  open() {
    this.isOpen = true;
    this.query = '';
    this.results = [];
    this.highlightedIndex = 0;
    // Defer focus until Angular renders the input.
    setTimeout(() => this.queryInput?.nativeElement?.focus(), 0);
  }

  close() {
    this.isOpen = false;
  }

  onQueryChange(value: string) {
    this.queryStream.next(value);
  }

  move(delta: number) {
    if (this.results.length === 0) return;
    const next =
      (this.highlightedIndex + delta + this.results.length) % this.results.length;
    this.highlightedIndex = next;
    // Scroll the highlighted item into view if needed.
    setTimeout(() => {
      const list = document.querySelector('[role="dialog"] ul');
      const item = list?.children[next] as HTMLElement | undefined;
      item?.scrollIntoView({ block: 'nearest' });
    }, 0);
  }

  select(index: number) {
    const r = this.results[index];
    if (!r) return;
    this.close();
    this.router.navigateByUrl(r.url);
  }

  meta(type: SearchResultType): TypeMeta {
    return TYPE_META[type];
  }
}
