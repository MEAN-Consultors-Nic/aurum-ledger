import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime } from 'rxjs';
import { ConfirmService } from '../../core/services/confirm.service';
import {
  VAULT_CATEGORIES,
  VAULT_CATEGORY_LABELS,
  VaultAccessLogEntry,
  VaultCategory,
  VaultCategoryCount,
  VaultEntry,
} from '../../core/models/vault.model';
import { VaultApiService } from '../../core/services/vault-api.service';

type EditableField = { key: string; value: string };

type Mode = 'view' | 'edit' | 'new';

@Component({
  selector: 'app-vault',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-5">
      <!-- Header -->
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold text-slate-900">Vault</h1>
          <p class="mt-0.5 text-sm text-slate-500">
            Encrypted secrets store. Replace the spreadsheet.
          </p>
        </div>
        <button
          type="button"
          (click)="openNew()"
          class="rounded-md bg-navy-700 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-navy-800"
        >
          + New entry
        </button>
      </div>

      <div class="grid gap-5 lg:grid-cols-[220px_1fr]">
        <!-- Categories -->
        <aside class="space-y-1">
          <div class="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Categories
          </div>
          <button
            *ngFor="let c of categoryFilters()"
            type="button"
            (click)="selectCategory(c.category)"
            class="flex w-full items-center justify-between rounded-md px-3 py-1.5 text-sm transition"
            [class.bg-navy-50]="activeCategory() === c.category"
            [class.text-navy-700]="activeCategory() === c.category"
            [class.font-medium]="activeCategory() === c.category"
            [class.text-slate-600]="activeCategory() !== c.category"
            [class.hover:bg-slate-100]="activeCategory() !== c.category"
          >
            <span>{{ c.category === 'all' ? 'All' : labelFor(c.category) }}</span>
            <span class="text-[11px] text-slate-400">{{ c.count }}</span>
          </button>
        </aside>

        <!-- Right column: search + grid -->
        <div class="space-y-4">
          <div class="flex items-center gap-2">
            <div class="relative flex-1">
              <svg class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="11" cy="11" r="8"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                type="text"
                [(ngModel)]="searchTerm"
                (ngModelChange)="searchChanged($event)"
                placeholder="Search by name, url, username, notes…"
                class="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm placeholder-slate-400 focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              />
            </div>
            <button
              type="button"
              (click)="toggleFavoritesOnly()"
              class="rounded-md border px-3 py-2 text-xs uppercase tracking-wide transition"
              [class.border-amber-300]="favoritesOnly()"
              [class.bg-amber-50]="favoritesOnly()"
              [class.text-amber-700]="favoritesOnly()"
              [class.border-slate-200]="!favoritesOnly()"
              [class.text-slate-600]="!favoritesOnly()"
            >
              ★ Favorites
            </button>
          </div>

          <div *ngIf="loading()" class="text-sm text-slate-500">Loading…</div>

          <div *ngIf="!loading() && entries().length === 0" class="rounded-lg border border-dashed border-slate-200 bg-white px-6 py-12 text-center">
            <p class="text-sm text-slate-500">No entries match.</p>
            <button
              type="button"
              (click)="openNew()"
              class="mt-3 text-sm font-medium text-navy-700 hover:underline"
            >
              Create your first entry →
            </button>
          </div>

          <div *ngIf="!loading() && entries().length > 0" class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <button
              *ngFor="let e of entries()"
              type="button"
              (click)="openEntry(e)"
              class="group rounded-lg border border-slate-200 bg-white p-4 text-left transition hover:border-navy-300 hover:shadow-sm"
            >
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0 flex-1">
                  <div class="truncate text-sm font-semibold text-slate-900">{{ e.name }}</div>
                  <div *ngIf="e.username" class="mt-0.5 truncate font-mono text-[11px] text-slate-500">{{ e.username }}</div>
                </div>
                <span class="shrink-0 rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-medium text-navy-700">
                  {{ labelFor(e.category) }}
                </span>
              </div>
              <div *ngIf="e.url" class="mt-2 truncate text-[11px] text-slate-400">{{ e.url }}</div>
              <div *ngIf="e.tags.length > 0" class="mt-2 flex flex-wrap gap-1">
                <span *ngFor="let t of e.tags" class="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                  {{ t }}
                </span>
              </div>
              <div class="mt-3 flex items-center justify-between text-[10px] text-slate-400">
                <span *ngIf="e.lastAccessedAt; else neverSeen">
                  Last seen {{ formatRelative(e.lastAccessedAt) }}
                </span>
                <ng-template #neverSeen>
                  <span>Never accessed</span>
                </ng-template>
                <span *ngIf="e.favorite" class="text-amber-500">★</span>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Slide-over -->
      <div
        *ngIf="selected() || mode() === 'new'"
        class="fixed inset-0 z-40 bg-slate-900/30"
        (click)="closePanel()"
      ></div>
      <aside
        *ngIf="selected() || mode() === 'new'"
        class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl"
      >
        <header class="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="rounded-full bg-navy-50 px-2 py-0.5 text-[10px] font-medium text-navy-700">
                {{ labelFor((selected()?.category ?? form.category) || 'other') }}
              </span>
              <button
                *ngIf="mode() === 'view' && selected()"
                type="button"
                (click)="toggleFavorite()"
                class="text-base"
                [class.text-amber-500]="selected()!.favorite"
                [class.text-slate-300]="!selected()!.favorite"
                title="Toggle favorite"
              >★</button>
            </div>
            <h2 *ngIf="mode() === 'view'" class="mt-2 truncate text-lg font-semibold text-slate-900">
              {{ selected()?.name }}
            </h2>
            <h2 *ngIf="mode() !== 'view'" class="mt-2 text-lg font-semibold text-slate-900">
              {{ mode() === 'new' ? 'New entry' : 'Edit entry' }}
            </h2>
          </div>
          <button
            type="button"
            (click)="closePanel()"
            class="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </header>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <!-- View mode -->
          <div *ngIf="mode() === 'view' && selected() as s" class="space-y-4">
            <div *ngIf="s.url">
              <div class="text-[10px] font-medium uppercase tracking-wide text-slate-400">URL</div>
              <a [href]="s.url" target="_blank" rel="noopener" class="break-all text-sm text-navy-700 hover:underline">{{ s.url }}</a>
            </div>
            <div *ngIf="s.username">
              <div class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Username</div>
              <div class="flex items-center gap-2">
                <code class="flex-1 break-all font-mono text-sm text-slate-900">{{ s.username }}</code>
                <button type="button" (click)="copy(s.username!)" class="text-[11px] text-slate-500 hover:text-slate-800">Copy</button>
              </div>
            </div>

            <!-- Secret fields -->
            <div>
              <div class="flex items-center justify-between">
                <div class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Secrets</div>
                <button
                  *ngIf="!revealed()"
                  type="button"
                  (click)="reveal()"
                  [disabled]="revealing()"
                  class="rounded-md bg-navy-700 px-2.5 py-1 text-[11px] font-medium text-white transition hover:bg-navy-800 disabled:bg-slate-300"
                >
                  {{ revealing() ? 'Decrypting…' : 'Reveal' }}
                </button>
                <button
                  *ngIf="revealed()"
                  type="button"
                  (click)="hide()"
                  class="rounded-md border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 hover:bg-slate-50"
                >
                  Hide
                </button>
              </div>
              <div *ngIf="!revealed()" class="mt-2 rounded-md border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-[11px] text-slate-500">
                Click <strong>Reveal</strong> to decrypt. Access is logged.
              </div>
              <div *ngIf="revealed() as r" class="mt-2 space-y-2">
                <div *ngFor="let kv of revealedRows(r)" class="rounded-md border border-slate-200 bg-white p-2.5">
                  <div class="text-[10px] font-medium uppercase tracking-wide text-slate-400">{{ kv.key }}</div>
                  <div class="mt-0.5 flex items-center gap-2">
                    <code class="flex-1 break-all font-mono text-sm text-slate-900">{{ kv.value }}</code>
                    <button type="button" (click)="copy(kv.value)" class="text-[11px] text-slate-500 hover:text-slate-800">Copy</button>
                  </div>
                </div>
              </div>
            </div>

            <div *ngIf="s.notes">
              <div class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Notes</div>
              <p class="whitespace-pre-wrap text-sm text-slate-700">{{ s.notes }}</p>
            </div>

            <div *ngIf="s.tags.length > 0">
              <div class="text-[10px] font-medium uppercase tracking-wide text-slate-400">Tags</div>
              <div class="flex flex-wrap gap-1">
                <span *ngFor="let t of s.tags" class="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">{{ t }}</span>
              </div>
            </div>

            <!-- Audit -->
            <details class="rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
              <summary class="cursor-pointer text-[11px] font-medium uppercase tracking-wide text-slate-500">
                Access history
              </summary>
              <ul *ngIf="audit().length > 0" class="mt-2 space-y-1 text-[11px] text-slate-600">
                <li *ngFor="let log of audit()" class="flex items-start justify-between gap-2">
                  <span>
                    <strong class="font-medium text-slate-800">{{ log.action }}</strong>
                    <span class="ml-1 text-slate-400">{{ userName(log.userId) }}</span>
                  </span>
                  <span class="shrink-0 text-slate-400">{{ formatRelative(log.createdAt) }}</span>
                </li>
              </ul>
              <p *ngIf="audit().length === 0" class="mt-2 text-[11px] text-slate-400">No access events recorded yet.</p>
            </details>
          </div>

          <!-- Edit / New form -->
          <form *ngIf="mode() !== 'view'" class="space-y-3" (ngSubmit)="save()">
            <div>
              <label class="text-[11px] font-medium text-slate-600">Name *</label>
              <input
                type="text"
                [(ngModel)]="form.name"
                name="name"
                required
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                placeholder="BAC Personal"
              />
            </div>
            <div>
              <label class="text-[11px] font-medium text-slate-600">Category</label>
              <select
                [(ngModel)]="form.category"
                name="category"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              >
                <option *ngFor="let c of allCategories" [value]="c">{{ labelFor(c) }}</option>
              </select>
            </div>
            <div class="grid grid-cols-2 gap-2">
              <div>
                <label class="text-[11px] font-medium text-slate-600">URL</label>
                <input
                  type="text"
                  [(ngModel)]="form.url"
                  name="url"
                  class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                  placeholder="https://"
                />
              </div>
              <div>
                <label class="text-[11px] font-medium text-slate-600">Username</label>
                <input
                  type="text"
                  [(ngModel)]="form.username"
                  name="username"
                  class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                />
              </div>
            </div>

            <div>
              <div class="flex items-center justify-between">
                <label class="text-[11px] font-medium text-slate-600">Secret fields</label>
                <button type="button" (click)="addField()" class="text-[11px] text-navy-700 hover:underline">+ Add field</button>
              </div>
              <div class="mt-1 space-y-2">
                <div *ngFor="let f of form.fields; let i = index; trackBy: trackByIndex" class="flex items-center gap-2">
                  <input
                    type="text"
                    [(ngModel)]="f.key"
                    [name]="'fkey-' + i"
                    placeholder="key (e.g. password)"
                    class="w-32 rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                  />
                  <input
                    type="text"
                    [(ngModel)]="f.value"
                    [name]="'fval-' + i"
                    placeholder="value"
                    class="flex-1 rounded-md border border-slate-200 px-2 py-1.5 font-mono text-xs focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                  />
                  <button type="button" (click)="removeField(i)" class="text-slate-400 hover:text-rose-600">×</button>
                </div>
              </div>
            </div>

            <div>
              <label class="text-[11px] font-medium text-slate-600">Tags (comma-separated)</label>
              <input
                type="text"
                [(ngModel)]="form.tagsRaw"
                name="tagsRaw"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
                placeholder="banking, personal"
              />
            </div>

            <div>
              <label class="text-[11px] font-medium text-slate-600">Notes</label>
              <textarea
                [(ngModel)]="form.notes"
                name="notes"
                rows="3"
                class="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:border-navy-600 focus:outline-none focus:ring-2 focus:ring-navy-600/15"
              ></textarea>
            </div>

            <label class="flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" [(ngModel)]="form.favorite" name="favorite" class="h-3.5 w-3.5 accent-navy-700"/>
              Mark as favorite
            </label>

            <div *ngIf="error()" class="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              {{ error() }}
            </div>
          </form>
        </div>

        <footer class="border-t border-slate-200 px-5 py-3">
          <div *ngIf="mode() === 'view'" class="flex items-center justify-between gap-2">
            <button
              type="button"
              (click)="remove()"
              class="text-xs text-rose-600 hover:underline"
            >Delete</button>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="closePanel()"
                class="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              >Close</button>
              <button
                type="button"
                (click)="startEdit()"
                class="rounded-md bg-navy-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800"
              >Edit</button>
            </div>
          </div>
          <div *ngIf="mode() !== 'view'" class="flex items-center justify-end gap-2">
            <button
              type="button"
              (click)="mode() === 'new' ? closePanel() : cancelEdit()"
              class="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
            >Cancel</button>
            <button
              type="button"
              (click)="save()"
              [disabled]="saving()"
              class="rounded-md bg-navy-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-navy-800 disabled:bg-slate-300"
            >{{ saving() ? 'Saving…' : 'Save' }}</button>
          </div>
        </footer>
      </aside>
    </div>
  `,
})
export class VaultComponent implements OnInit, OnDestroy {
  readonly allCategories = VAULT_CATEGORIES;

  entries = signal<VaultEntry[]>([]);
  counts = signal<VaultCategoryCount[]>([]);
  loading = signal(true);
  activeCategory = signal<VaultCategory | 'all'>('all');
  favoritesOnly = signal(false);

  selected = signal<VaultEntry | null>(null);
  mode = signal<Mode>('view');
  revealing = signal(false);
  revealed = signal<Record<string, unknown> | null>(null);
  audit = signal<VaultAccessLogEntry[]>([]);
  saving = signal(false);
  error = signal('');

  searchTerm = '';
  private readonly search$ = new Subject<string>();

  form: {
    name: string;
    category: VaultCategory;
    url: string;
    username: string;
    notes: string;
    fields: EditableField[];
    tagsRaw: string;
    favorite: boolean;
  } = this.emptyForm();

  constructor(
    private readonly api: VaultApiService,
    private readonly confirm: ConfirmService,
  ) {}

  ngOnInit() {
    this.refresh();
    this.refreshCounts();
    this.search$.pipe(debounceTime(180)).subscribe(() => this.refresh());
  }

  ngOnDestroy() {
    this.search$.complete();
  }

  categoryFilters() {
    return this.counts();
  }

  labelFor(c: VaultCategory | 'all' | string) {
    if (c === 'all') return 'All';
    return VAULT_CATEGORY_LABELS[c as VaultCategory] ?? c;
  }

  searchChanged(v: string) {
    this.search$.next(v);
  }

  selectCategory(c: VaultCategory | 'all') {
    this.activeCategory.set(c);
    this.refresh();
  }

  toggleFavoritesOnly() {
    this.favoritesOnly.set(!this.favoritesOnly());
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    const cat = this.activeCategory();
    this.api
      .list({
        q: this.searchTerm || undefined,
        category: cat === 'all' ? undefined : cat,
        favorite: this.favoritesOnly() || undefined,
      })
      .subscribe({
        next: (items) => {
          this.entries.set(items);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  refreshCounts() {
    this.api.categoryCounts().subscribe({
      next: (counts) => this.counts.set(counts),
      error: () => this.counts.set([]),
    });
  }

  openEntry(e: VaultEntry) {
    this.selected.set(e);
    this.mode.set('view');
    this.revealed.set(null);
    this.audit.set([]);
    this.api.audit(e._id).subscribe({ next: (rows) => this.audit.set(rows) });
  }

  openNew() {
    this.selected.set(null);
    this.mode.set('new');
    this.form = this.emptyForm();
    this.error.set('');
  }

  startEdit() {
    const s = this.selected();
    if (!s) return;
    // Need to pull current fields — call reveal so the form has them.
    this.api.reveal(s._id).subscribe({
      next: (r) => {
        this.form = {
          name: r.name,
          category: r.category,
          url: r.url ?? '',
          username: r.username ?? '',
          notes: r.notes ?? '',
          tagsRaw: (r.tags ?? []).join(', '),
          favorite: r.favorite,
          fields: Object.entries(r.fields).map(([key, value]) => ({
            key,
            value: typeof value === 'string' ? value : JSON.stringify(value),
          })),
        };
        if (this.form.fields.length === 0) {
          this.form.fields.push({ key: 'password', value: '' });
        }
        this.mode.set('edit');
        this.error.set('');
      },
      error: () => this.error.set('Could not decrypt entry'),
    });
  }

  cancelEdit() {
    this.mode.set('view');
    this.error.set('');
  }

  closePanel() {
    this.selected.set(null);
    this.mode.set('view');
    this.revealed.set(null);
    this.audit.set([]);
    this.error.set('');
  }

  reveal() {
    const s = this.selected();
    if (!s) return;
    this.revealing.set(true);
    this.api.reveal(s._id).subscribe({
      next: (r) => {
        this.revealed.set(r.fields);
        this.revealing.set(false);
        // Refresh audit after a reveal logs the event.
        this.api.audit(s._id).subscribe({ next: (rows) => this.audit.set(rows) });
        // Bump in-place state for accessCount/lastAccessedAt.
        this.selected.set({ ...s, lastAccessedAt: new Date().toISOString(), accessCount: s.accessCount + 1 });
      },
      error: () => this.revealing.set(false),
    });
  }

  hide() {
    this.revealed.set(null);
  }

  revealedRows(fields: Record<string, unknown>) {
    return Object.entries(fields).map(([key, value]) => ({
      key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
  }

  addField() {
    this.form.fields.push({ key: '', value: '' });
  }

  removeField(i: number) {
    this.form.fields.splice(i, 1);
  }

  toggleFavorite() {
    const s = this.selected();
    if (!s) return;
    const next = !s.favorite;
    this.api.update(s._id, { favorite: next }).subscribe({
      next: () => {
        this.selected.set({ ...s, favorite: next });
        this.refresh();
      },
    });
  }

  save() {
    if (!this.form.name.trim()) {
      this.error.set('Name is required');
      return;
    }
    this.saving.set(true);
    const fields = this.form.fields
      .filter((f) => f.key.trim().length > 0)
      .reduce<Record<string, unknown>>((acc, f) => ({ ...acc, [f.key.trim()]: f.value }), {});
    const tags = this.form.tagsRaw
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (this.mode() === 'new') {
      this.api
        .create({
          name: this.form.name.trim(),
          category: this.form.category,
          url: this.form.url || undefined,
          username: this.form.username || undefined,
          notes: this.form.notes || undefined,
          tags,
          fields,
          favorite: this.form.favorite,
        })
        .subscribe({
          next: (e) => {
            this.saving.set(false);
            this.refresh();
            this.refreshCounts();
            this.openEntry(e);
          },
          error: () => {
            this.saving.set(false);
            this.error.set('Could not save entry');
          },
        });
      return;
    }

    // Edit mode
    const s = this.selected();
    if (!s) return;
    this.api
      .update(s._id, {
        name: this.form.name.trim(),
        category: this.form.category,
        url: this.form.url || undefined,
        username: this.form.username || undefined,
        notes: this.form.notes || undefined,
        tags,
        fields,
        favorite: this.form.favorite,
      })
      .subscribe({
        next: (e) => {
          this.saving.set(false);
          this.selected.set(e);
          this.mode.set('view');
          this.refresh();
          this.refreshCounts();
        },
        error: () => {
          this.saving.set(false);
          this.error.set('Could not save entry');
        },
      });
  }

  async remove() {
    const s = this.selected();
    if (!s) return;
    const ok = await this.confirm.open({
      title: 'Delete entry',
      message: `Delete "${s.name}"? The encrypted secret will be removed.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(s._id).subscribe({
      next: () => {
        this.closePanel();
        this.refresh();
        this.refreshCounts();
      },
    });
  }

  copy(value: string) {
    navigator.clipboard?.writeText(value);
  }

  userName(u: VaultAccessLogEntry['userId']) {
    if (!u) return '';
    if (typeof u === 'string') return '';
    return u.name || u.email || '';
  }

  formatRelative(iso: string | Date | undefined) {
    if (!iso) return '';
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    const diffMs = Date.now() - d.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    if (diffSec < 60) return 'just now';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return `${diffH}h ago`;
    const diffD = Math.floor(diffH / 24);
    if (diffD < 30) return `${diffD}d ago`;
    return d.toLocaleDateString();
  }

  trackByIndex(i: number) {
    return i;
  }

  private emptyForm() {
    return {
      name: '',
      category: 'personal' as VaultCategory,
      url: '',
      username: '',
      notes: '',
      tagsRaw: '',
      favorite: false,
      fields: [{ key: 'password', value: '' }],
    };
  }
}
