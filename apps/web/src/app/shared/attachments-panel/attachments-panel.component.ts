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

@Component({
  selector: 'app-attachments-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header class="flex items-start justify-between border-b border-slate-100 px-5 py-4">
        <div>
          <div class="text-sm font-semibold text-slate-900">Attachments</div>
          <div class="text-xs text-slate-500">
            Files are stored privately in S3. Downloads use short-lived signed URLs.
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
        class="m-5 rounded-lg border-2 border-dashed px-4 py-6 text-center text-xs transition"
        [ngClass]="isDragging ? 'border-slate-900 bg-slate-50 text-slate-900' : 'border-slate-200 text-slate-500'"
        (dragenter)="onDragEnter($event)"
        (dragover)="onDragOver($event)"
        (dragleave)="onDragLeave($event)"
        (drop)="onDrop($event)"
      >
        Drag files here or click <span class="font-semibold">Upload</span> · max 25 MB per file
      </div>

      <!-- In-progress uploads -->
      <ul *ngIf="uploading.length > 0" class="space-y-1 border-t border-slate-100 px-5 py-3">
        <li *ngFor="let u of uploading" class="text-xs">
          <div class="flex items-center justify-between">
            <span class="truncate font-medium text-slate-700">{{ u.name }}</span>
            <span class="ml-2 tabular-nums text-slate-500"
              [ngClass]="u.error ? 'text-rose-600' : ''">
              {{ u.error ? u.error : (u.total > 0 ? ((u.loaded / u.total) * 100 | number:'1.0-0') + '%' : '…') }}
            </span>
          </div>
          <div *ngIf="!u.error" class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div class="h-full bg-slate-900 transition-all"
              [style.width.%]="u.total > 0 ? (u.loaded / u.total) * 100 : 0"></div>
          </div>
        </li>
      </ul>

      <!-- Existing attachments -->
      <ul *ngIf="items.length > 0" class="divide-y divide-slate-100">
        <li *ngFor="let f of items" class="flex items-center gap-3 px-5 py-2.5">
          <span class="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
            {{ extension(f.filename) }}
          </span>
          <div class="min-w-0 flex-1">
            <div class="truncate text-sm font-medium text-slate-900">{{ f.filename }}</div>
            <div class="text-[11px] text-slate-500">
              {{ formatBytes(f.sizeBytes) }}
              <span *ngIf="uploaderName(f) as u"> · uploaded by {{ u }}</span>
              <span *ngIf="f.uploadedAt"> · {{ formatRelative(f.uploadedAt) }}</span>
            </div>
          </div>
          <button
            type="button"
            (click)="download(f)"
            class="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50"
          >
            Download
          </button>
          <button
            type="button"
            (click)="remove(f)"
            class="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-100"
          >
            Delete
          </button>
        </li>
      </ul>

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
          }
        },
        error: (err) => {
          entry.error = err?.error?.message ?? err?.message ?? 'Upload failed';
          this.uploading = [...this.uploading];
          // Leave the failed row in place for visibility for ~5s then drop.
          setTimeout(() => {
            this.uploading = this.uploading.filter((u) => u.id !== id);
          }, 5000);
        },
      });
    }
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

  download(f: AttachmentItem) {
    this.api.download(f._id).subscribe({
      next: (res) => {
        // Open the presigned URL in a new tab — fresh 10-min signed URL.
        window.open(res.url, '_blank', 'noopener');
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Unable to generate download link';
      },
    });
  }

  uploaderName(f: AttachmentItem): string {
    if (!f.uploadedBy) return '';
    if (typeof f.uploadedBy === 'string') return '';
    return f.uploadedBy.name ?? f.uploadedBy.email ?? '';
  }

  extension(name: string): string {
    const ext = name.split('.').pop() ?? '';
    return ext.length <= 5 ? ext : 'FILE';
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
