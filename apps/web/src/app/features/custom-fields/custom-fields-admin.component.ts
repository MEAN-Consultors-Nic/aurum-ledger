import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../core/services/confirm.service';
import { CustomFieldsApiService } from '../../core/services/custom-fields-api.service';
import {
  CustomFieldDefinition,
  CustomFieldEntityType,
  CustomFieldType,
  ENTITY_TYPE_OPTIONS,
  FIELD_TYPE_OPTIONS,
} from '../../core/models/custom-field.model';

type Draft = {
  _id?: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: CustomFieldType;
  optionsText: string; // comma/newline-separated input
  required: boolean;
  placeholder: string;
  helpText: string;
  order: number;
  active: boolean;
};

@Component({
  selector: 'app-custom-fields-admin',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="space-y-6">
      <header class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div class="text-2xl font-semibold tracking-tight text-slate-900">Custom fields</div>
          <div class="mt-1 text-sm text-slate-500">
            Add your own fields to clients, projects, contracts, estimates, tasks and services — no code required.
          </div>
        </div>
        <button
          (click)="openCreate()"
          class="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-white"
        >
          + Add field
        </button>
      </header>

      <!-- Entity tabs -->
      <div class="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        <button
          *ngFor="let opt of entityOptions"
          (click)="selectEntity(opt.value)"
          class="rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition"
          [ngClass]="opt.value === activeEntity
            ? 'bg-white text-slate-900 shadow-sm'
            : 'text-slate-500 hover:text-slate-900'"
        >
          {{ opt.label }}
          <span *ngIf="countFor(opt.value) > 0" class="ml-1 text-slate-400">
            {{ countFor(opt.value) }}
          </span>
        </button>
      </div>

      <!-- List -->
      <section class="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div *ngIf="isLoading" class="px-5 py-8 text-center text-sm text-slate-500">Loading…</div>

        <div *ngIf="!isLoading && filteredDefs().length === 0"
          class="px-5 py-12 text-center text-sm text-slate-500">
          No custom fields for <span class="font-semibold text-slate-700">{{ activeEntity }}</span> yet.
        </div>

        <ul *ngIf="!isLoading && filteredDefs().length > 0" class="divide-y divide-slate-100">
          <li *ngFor="let def of filteredDefs()"
            class="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-slate-50">
            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-[10px] font-bold uppercase text-slate-600">
              {{ typeShort(def.type) }}
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-slate-900">{{ def.label }}</span>
                <span *ngIf="def.required"
                  class="rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700">
                  Required
                </span>
                <span *ngIf="!def.active"
                  class="rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
                  Hidden
                </span>
              </div>
              <div class="text-[11px] text-slate-500">
                <span class="font-mono">{{ def.key }}</span> · {{ typeLabel(def.type) }}
                <span *ngIf="def.type === 'select' && def.options?.length">
                  · {{ def.options.length }} option{{ def.options.length === 1 ? '' : 's' }}
                </span>
              </div>
              <div *ngIf="def.helpText" class="mt-0.5 text-[11px] text-slate-400">{{ def.helpText }}</div>
            </div>
            <button (click)="openEdit(def)"
              class="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-50">
              Edit
            </button>
            <button (click)="remove(def)"
              class="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-rose-700 hover:bg-rose-100">
              Delete
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- Form modal -->
    <div *ngIf="isFormOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div class="flex items-center justify-between">
          <div class="text-base font-semibold text-slate-900">
            {{ draft._id ? 'Edit field' : 'New custom field' }}
          </div>
          <button (click)="closeForm()" class="text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div class="mt-4 space-y-3">
          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Applies to</label>
              <select
                [(ngModel)]="draft.entityType"
                [disabled]="!!draft._id"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              >
                <option *ngFor="let opt of entityOptions" [value]="opt.value">{{ opt.label }}</option>
              </select>
            </div>
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Type</label>
              <select
                [(ngModel)]="draft.type"
                [disabled]="!!draft._id"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              >
                <option *ngFor="let opt of typeOptions" [value]="opt.value">{{ opt.label }}</option>
              </select>
            </div>
          </div>

          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Label</label>
            <input
              [(ngModel)]="draft.label"
              (ngModelChange)="onLabelChange($event)"
              placeholder="e.g. NIT, VIP score, Stack"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Key</label>
            <input
              [(ngModel)]="draft.key"
              [disabled]="!!draft._id"
              placeholder="auto-generated from label"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono text-xs"
            />
            <div class="mt-1 text-[10px] text-slate-500">
              Machine identifier. Lowercase letters, numbers and underscores only. Cannot be changed after creation.
            </div>
          </div>

          <div *ngIf="draft.type === 'select'">
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Options</label>
            <textarea
              [(ngModel)]="draft.optionsText"
              rows="3"
              placeholder="One option per line"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            ></textarea>
          </div>

          <div class="grid gap-3 sm:grid-cols-2">
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Placeholder</label>
              <input
                [(ngModel)]="draft.placeholder"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
            <div>
              <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Order</label>
              <input
                [(ngModel)]="draft.order"
                type="number"
                min="0"
                class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label class="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Help text</label>
            <input
              [(ngModel)]="draft.helpText"
              class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          <div class="grid gap-2 sm:grid-cols-2">
            <label class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input type="checkbox" [(ngModel)]="draft.required" />
              <span class="text-sm text-slate-700">Required</span>
            </label>
            <label class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <input type="checkbox" [(ngModel)]="draft.active" />
              <span class="text-sm text-slate-700">Active (visible)</span>
            </label>
          </div>

          <div *ngIf="formError" class="text-xs text-rose-600">{{ formError }}</div>
        </div>

        <div class="mt-5 flex justify-end gap-2">
          <button (click)="closeForm()"
            class="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-slate-700">
            Cancel
          </button>
          <button
            (click)="save()"
            [disabled]="isSaving || !draft.label.trim() || !draft.key.trim()"
            class="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white disabled:opacity-50"
          >
            {{ isSaving ? 'Saving…' : (draft._id ? 'Save changes' : 'Create field') }}
          </button>
        </div>
      </div>
    </div>
  `,
})
export class CustomFieldsAdminComponent implements OnInit {
  definitions: CustomFieldDefinition[] = [];
  isLoading = false;
  activeEntity: CustomFieldEntityType = 'client';

  isFormOpen = false;
  isSaving = false;
  formError = '';
  draft: Draft = this.blankDraft();

  readonly entityOptions = ENTITY_TYPE_OPTIONS;
  readonly typeOptions = FIELD_TYPE_OPTIONS;

  constructor(
    private readonly api: CustomFieldsApiService,
    private readonly confirmDialog: ConfirmService,
  ) {}

  ngOnInit() {
    this.load();
  }

  load() {
    this.isLoading = true;
    this.api.list().subscribe({
      next: (defs) => {
        this.definitions = defs;
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  selectEntity(entity: CustomFieldEntityType) {
    this.activeEntity = entity;
  }

  countFor(entity: CustomFieldEntityType): number {
    return this.definitions.filter((d) => d.entityType === entity).length;
  }

  filteredDefs(): CustomFieldDefinition[] {
    return this.definitions
      .filter((d) => d.entityType === this.activeEntity)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.label.localeCompare(b.label));
  }

  openCreate() {
    this.draft = this.blankDraft(this.activeEntity);
    this.formError = '';
    this.isFormOpen = true;
  }

  openEdit(def: CustomFieldDefinition) {
    this.draft = {
      _id: def._id,
      entityType: def.entityType,
      key: def.key,
      label: def.label,
      type: def.type,
      optionsText: (def.options ?? []).join('\n'),
      required: !!def.required,
      placeholder: def.placeholder ?? '',
      helpText: def.helpText ?? '',
      order: def.order ?? 0,
      active: !!def.active,
    };
    this.formError = '';
    this.isFormOpen = true;
  }

  closeForm() {
    this.isFormOpen = false;
  }

  onLabelChange(label: string) {
    if (this.draft._id) return; // key is immutable once created
    this.draft.key = this.slugifyKey(label);
  }

  save() {
    this.isSaving = true;
    this.formError = '';
    const options = this.draft.type === 'select'
      ? this.draft.optionsText
          .split(/\r?\n|,/)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : [];

    if (this.draft.type === 'select' && options.length === 0) {
      this.isSaving = false;
      this.formError = 'Select fields need at least one option';
      return;
    }

    const basePayload = {
      label: this.draft.label.trim(),
      type: this.draft.type,
      options,
      required: this.draft.required,
      placeholder: this.draft.placeholder?.trim() || undefined,
      helpText: this.draft.helpText?.trim() || undefined,
      order: Number(this.draft.order) || 0,
      active: this.draft.active,
    };

    const obs = this.draft._id
      ? this.api.update(this.draft._id, basePayload)
      : this.api.create({
          ...basePayload,
          entityType: this.draft.entityType,
          key: this.draft.key,
        });

    obs.subscribe({
      next: () => {
        this.isSaving = false;
        this.isFormOpen = false;
        this.load();
      },
      error: (err) => {
        this.isSaving = false;
        this.formError = err?.error?.message ?? 'Unable to save field';
      },
    });
  }

  async remove(def: CustomFieldDefinition) {
    const ok = await this.confirmDialog.open({
      title: 'Delete field',
      message: `Delete "${def.label}"? Existing values are kept in the database but the field stops showing in forms.`,
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;
    this.api.remove(def._id).subscribe({
      next: () => (this.definitions = this.definitions.filter((d) => d._id !== def._id)),
    });
  }

  // ----- helpers -----

  typeLabel(t: CustomFieldType): string {
    return FIELD_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
  }

  typeShort(t: CustomFieldType): string {
    if (t === 'textarea') return 'TXT';
    if (t === 'number') return 'NUM';
    if (t === 'boolean') return 'Y/N';
    if (t === 'select') return 'SEL';
    if (t === 'date') return 'DAT';
    if (t === 'url') return 'URL';
    return 'TXT';
  }

  private slugifyKey(label: string): string {
    return label
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }

  private blankDraft(entity: CustomFieldEntityType = 'client'): Draft {
    return {
      entityType: entity,
      key: '',
      label: '',
      type: 'text',
      optionsText: '',
      required: false,
      placeholder: '',
      helpText: '',
      order: 0,
      active: true,
    };
  }
}
