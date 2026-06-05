import {
  Component,
  ElementRef,
  Input,
  OnChanges,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { AttachmentsApiService } from '../../core/services/attachments-api.service';
import {
  AttachmentItem,
  AttachmentParentType,
} from '../../core/models/attachment.model';
import { ConfirmService } from '../../core/services/confirm.service';

type UploadingFile = {
  id: string;
  name: string;
  sizeBytes: number;
  loaded: number;
  total: number;
  error?: string;
};

type FileKind = 'image' | 'video' | 'audio' | 'pdf' | 'doc' | 'sheet' | 'archive' | 'code' | 'file';

@Component({
  selector: 'app-attachments-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header class="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div class="text-sm font-semibold text-slate-900">
            Attachments
            <span *ngIf="items.length > 0" class="ml-1 text-slate-400">({{ items.length }})</span>
          </div>
          <div class="text-xs text-slate-500">
            Files are stored privately in S3. Image previews and downloads use short-lived signed URLs.
          </div>
        </div>
        <button
          type="button"
          (click)="picker.click()"
          class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
        >
          + Upload
        </button>
        <input
          #picker
          type="file"
          multiple
          class="hidden"
          (change)="onPickerChange($event)"
        />
      </header>

      <!-- Drop area -->
      <div
        class="m-5 rounded-xl border-2 border-dashed px-4 py-6 text-center text-xs transition"
        [ngClass]="isDragging
          ? 'border-slate-900 bg-slate-50 text-slate-900'
          : 'border-slate-200 text-slate-500'"
        (dragenter)="onDragEnter($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        Drag files here or click <span class="font-semibold">Upload</span> · max 25 MB per file
      </div>

      <!-- In-progress uploads -->
      <ul *ngIf="uploading.length > 0" class="space-y-1 px-5 pb-3">
        <li *ngFor="let u of uploading" class="text-xs">
          <div class="flex items-center justify-between">
            <span class="truncate font-medium text-slate-700">{{ u.name }}</span>
            <span class="ml-2 tabular-nums"
              [ngClass]="u.error ? 'text-rose-600' : 'text-slate-500'">
              {{ u.error ? u.error : (u.total > 0 ? ((u.loaded / u.total) * 100 | number:'1.0-0') + '%' : '…') }}
            </span>
          </div>
          <div *ngIf="!u.error" class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full bg-slate-900 transition-all"
              [style.width.%]="u.total > 0 ? (u.loaded / u.total) * 100 : 0"></div>
          </div>
        </li>
      </ul>

      <!-- Grid -->
      <div *ngIf="items.length > 0"
        class="grid gap-3 px-5 pb-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        <article
          *ngFor="let f of items"
          class="group relative overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:border-slate-300 hover:shadow-md"
        >
          <!-- Preview area (square) -->
          <div class="relative aspect-square w-full overflow-hidden bg-slate-100"
            [ngClass]="cardBg(kindOf(f))">
            <!-- Image thumbnail -->
            <img
              *ngIf="kindOf(f) === 'image' && f.previewUrl"
              [src]="f.previewUrl"
              [alt]="f.filename"
              loading="lazy"
              class="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
            <!-- Image without preview URL fallback -->
            <div *ngIf="kindOf(f) === 'image' && !f.previewUrl"
              class="flex h-full w-full items-center justify-center text-slate-400">
              <svg class="h-12 w-12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="9" cy="9" r="2"/>
                <path d="m21 15-5-5L5 21"/>
              </svg>
            </div>
            <!-- Non-image: icon + extension -->
            <div *ngIf="kindOf(f) !== 'image'"
              class="flex h-full w-full flex-col items-center justify-center gap-2"
              [ngClass]="iconColor(kindOf(f))">
              <ng-container [ngSwitch]="kindOf(f)">
                <svg *ngSwitchCase="'video'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="2" y="6" width="14" height="12" rx="2"/>
                  <polygon points="22 8 16 12 22 16 22 8" fill="currentColor"/>
                </svg>
                <svg *ngSwitchCase="'audio'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M9 18V5l12-2v13"/>
                  <circle cx="6" cy="18" r="3"/>
                  <circle cx="18" cy="16" r="3"/>
                </svg>
                <svg *ngSwitchCase="'pdf'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6"/>
                </svg>
                <svg *ngSwitchCase="'doc'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6"/>
                  <path d="M8 13h8"/>
                  <path d="M8 17h6"/>
                </svg>
                <svg *ngSwitchCase="'sheet'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2"/>
                  <path d="M3 9h18M3 15h18M9 3v18M15 3v18"/>
                </svg>
                <svg *ngSwitchCase="'archive'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 8v13H3V8"/>
                  <path d="M1 3h22v5H1z"/>
                  <path d="M10 12h4"/>
                </svg>
                <svg *ngSwitchCase="'code'" class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="16 18 22 12 16 6"/>
                  <polyline points="8 6 2 12 8 18"/>
                </svg>
                <svg *ngSwitchDefault class="h-14 w-14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <path d="M14 2v6h6"/>
                </svg>
              </ng-container>
              <span class="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
                {{ extension(f.filename) }}
              </span>
            </div>

            <!-- Hover overlay with actions -->
            <div class="absolute inset-0 flex items-end justify-end gap-1.5 bg-gradient-to-t from-slate-900/70 via-slate-900/0 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                (click)="download(f)"
                title="Download"
                aria-label="Download"
                class="rounded-md bg-white/90 p-1.5 text-slate-800 transition hover:bg-white"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
              </button>
              <button
                type="button"
                (click)="remove(f)"
                title="Delete"
                aria-label="Delete"
                class="rounded-md bg-rose-500/90 p-1.5 text-white transition hover:bg-rose-500"
              >
                <svg class="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"/>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Footer with filename + meta -->
          <div class="px-3 py-2">
            <div class="truncate text-xs font-medium text-slate-900" [title]="f.filename">
              {{ f.filename }}
            </div>
            <div class="mt-0.5 flex items-center justify-between text-[10px] text-slate-500">
              <span>{{ formatBytes(f.sizeBytes) }}</span>
              <span *ngIf="f.uploadedAt">{{ formatRelative(f.uploadedAt) }}</span>
            </div>
          </div>
        </article>
      </div>

      <div *ngIf="!isLoading && items.length === 0 && uploading.length === 0"
        class="px-5 pb-5 text-center text-xs text-slate-500">
        No attachments yet.
      </div>

      <div *ngIf="error" class="border-t border-rose-100 bg-rose-50 px-5 py-2 text-xs text-rose-700">
        {{ error }}
      </div>
    </section>
  `,
})
export class AttachmentsPanelComponent implements OnChanges {
  @Input() parentType!: AttachmentParentType;
  @Input() parentId!: string;

  @ViewChild('picker') picker!: ElementRef<HTMLInputElement>;

  items: AttachmentItem[] = [];
  uploading: UploadingFile[] = [];
  isLoading = false;
  isDragging = false;
  error = '';

  constructor(
    private readonly api: AttachmentsApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['parentId'] || changes['parentType']) && this.parentId && this.parentType) {
      this.load();
    }
  }

  load() {
    this.isLoading = true;
    this.api.list(this.parentType, this.parentId).subscribe({
      next: (items) => {
        this.items = items;
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.message ?? 'Unable to load attachments';
      },
    });
  }

  onPickerChange(event: Event) {
    const input = event.target as HTMLInputElement;
    if (!input.files) return;
    this.uploadFiles(Array.from(input.files));
    input.value = '';
  }

  onDragEnter(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }
  onDragOver(event: DragEvent) {
    event.preventDefault();
    this.isDragging = true;
  }
  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }
  onDrop(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
    if (!event.dataTransfer?.files) return;
    this.uploadFiles(Array.from(event.dataTransfer.files));
  }

  private uploadFiles(files: File[]) {
    if (!this.parentId || !this.parentType) return;
    this.error = '';
    for (const file of files) {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const entry: UploadingFile = {
        id,
        name: file.name,
        sizeBytes: file.size,
        loaded: 0,
        total: file.size,
      };
      this.uploading = [...this.uploading, entry];

      this.api.upload(file, this.parentType, this.parentId).subscribe({
        next: (event) => {
          if (event.kind === 'progress') {
            entry.loaded = event.loaded;
            entry.total = event.total;
            this.uploading = [...this.uploading];
          } else if (event.kind === 'done') {
            this.items = [event.attachment, ...this.items];
            this.uploading = this.uploading.filter((u) => u.id !== id);
            // The freshly created row doesn't have a previewUrl yet (the
            // controller doesn't sign on create). Refresh the list so the
            // new image gets its thumbnail.
            if (event.attachment.mimeType?.startsWith('image/')) {
              this.load();
            }
          }
        },
        error: (err) => {
          entry.error = err?.error?.message ?? err?.message ?? 'Upload failed';
          this.uploading = [...this.uploading];
          setTimeout(() => {
            this.uploading = this.uploading.filter((u) => u.id !== id);
          }, 5000);
        },
      });
    }
  }

  download(f: AttachmentItem) {
    this.api.download(f._id).subscribe({
      next: (res) => {
        window.open(res.url, '_blank', 'noopener');
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Unable to generate download link';
      },
    });
  }

  async remove(f: AttachmentItem) {
    const ok = await this.confirmDialog.open({
      title: 'Delete attachment',
      message: `Remove "${f.filename}"? This deletes the file from S3 too.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(f._id).subscribe({
      next: () => (this.items = this.items.filter((x) => x._id !== f._id)),
    });
  }

  kindOf(f: AttachmentItem): FileKind {
    const mt = f.mimeType ?? '';
    const ext = (f.filename.split('.').pop() ?? '').toLowerCase();
    if (mt.startsWith('image/')) return 'image';
    if (mt.startsWith('video/')) return 'video';
    if (mt.startsWith('audio/')) return 'audio';
    if (mt === 'application/pdf' || ext === 'pdf') return 'pdf';
    if (['doc', 'docx', 'odt', 'rtf', 'txt', 'md'].includes(ext)) return 'doc';
    if (['xls', 'xlsx', 'csv', 'ods'].includes(ext)) return 'sheet';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    if (['js', 'ts', 'tsx', 'jsx', 'json', 'html', 'css', 'scss', 'py', 'sh', 'go', 'rs', 'java', 'rb', 'php', 'sql'].includes(ext)) return 'code';
    return 'file';
  }

  cardBg(kind: FileKind): string {
    switch (kind) {
      case 'video':
        return 'bg-gradient-to-br from-violet-50 to-violet-100';
      case 'audio':
        return 'bg-gradient-to-br from-amber-50 to-amber-100';
      case 'pdf':
        return 'bg-gradient-to-br from-rose-50 to-rose-100';
      case 'doc':
        return 'bg-gradient-to-br from-sky-50 to-sky-100';
      case 'sheet':
        return 'bg-gradient-to-br from-emerald-50 to-emerald-100';
      case 'archive':
        return 'bg-gradient-to-br from-yellow-50 to-amber-100';
      case 'code':
        return 'bg-gradient-to-br from-slate-100 to-slate-200';
      default:
        return 'bg-slate-100';
    }
  }

  iconColor(kind: FileKind): string {
    switch (kind) {
      case 'video':
        return 'text-violet-600';
      case 'audio':
        return 'text-amber-600';
      case 'pdf':
        return 'text-rose-600';
      case 'doc':
        return 'text-sky-600';
      case 'sheet':
        return 'text-emerald-600';
      case 'archive':
        return 'text-amber-700';
      case 'code':
        return 'text-slate-700';
      default:
        return 'text-slate-500';
    }
  }

  extension(name: string): string {
    const ext = name.split('.').pop() ?? '';
    return ext.length <= 5 ? ext.toUpperCase() : 'FILE';
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  formatRelative(iso?: string): string {
    if (!iso) return '';
    const diff = Date.now() - new Date(iso).getTime();
    const sec = Math.floor(diff / 1000);
    if (sec < 60) return 'just now';
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const days = Math.floor(hr / 24);
    return `${days}d ago`;
  }
}
