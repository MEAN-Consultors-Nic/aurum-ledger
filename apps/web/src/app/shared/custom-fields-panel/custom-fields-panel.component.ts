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
import { CustomFieldsApiService } from '../../core/services/custom-fields-api.service';
import {
  CustomFieldDefinition,
  CustomFieldEntityType,
} from '../../core/models/custom-field.model';

@Component({
  selector: 'app-custom-fields-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div *ngIf="definitions.length > 0" class="space-y-3">
      <div *ngFor="let def of definitions" class="space-y-1">
        <label class="text-xs font-semibold uppercase tracking-wide text-slate-600">
          {{ def.label }}
          <span *ngIf="def.required" class="text-rose-500">*</span>
        </label>

        <!-- Text / URL -->
        <input
          *ngIf="def.type === 'text' || def.type === 'url'"
          [type]="def.type === 'url' ? 'url' : 'text'"
          [ngModel]="getValue(def)"
          (ngModelChange)="setValue(def.key, $event)"
          [placeholder]="def.placeholder || ''"
          [disabled]="disabled"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <!-- Textarea -->
        <textarea
          *ngIf="def.type === 'textarea'"
          [ngModel]="getValue(def)"
          (ngModelChange)="setValue(def.key, $event)"
          [placeholder]="def.placeholder || ''"
          [disabled]="disabled"
          rows="3"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        ></textarea>

        <!-- Number -->
        <input
          *ngIf="def.type === 'number'"
          type="number"
          [ngModel]="getValue(def)"
          (ngModelChange)="setValue(def.key, $event === '' ? null : Number($event))"
          [placeholder]="def.placeholder || ''"
          [disabled]="disabled"
          step="any"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <!-- Date -->
        <input
          *ngIf="def.type === 'date'"
          type="date"
          [ngModel]="toDateInput(getValue(def))"
          (ngModelChange)="setValue(def.key, $event)"
          [disabled]="disabled"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
        />

        <!-- Boolean -->
        <label *ngIf="def.type === 'boolean'"
          class="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
          <input
            type="checkbox"
            [ngModel]="!!getValue(def)"
            (ngModelChange)="setValue(def.key, $event)"
            [disabled]="disabled"
            class="h-4 w-4"
          />
          <span class="text-sm text-slate-700">{{ def.placeholder || 'Yes' }}</span>
        </label>

        <!-- Select -->
        <select
          *ngIf="def.type === 'select'"
          [ngModel]="getValue(def)"
          (ngModelChange)="setValue(def.key, $event)"
          [disabled]="disabled"
          class="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option [ngValue]="''">— Select —</option>
          <option *ngFor="let opt of def.options" [ngValue]="opt">{{ opt }}</option>
        </select>

        <div *ngIf="def.helpText" class="text-[11px] text-slate-500">{{ def.helpText }}</div>
      </div>
    </div>

    <div *ngIf="definitions.length === 0 && !isLoading && showEmptyHint"
      class="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-3 text-center text-xs text-slate-500">
      No custom fields defined for {{ entityType }} yet. Add some in
      <span class="font-semibold text-slate-700">Settings → Custom fields</span>.
    </div>
  `,
})
export class CustomFieldsPanelComponent implements OnChanges {
  @Input() entityType!: CustomFieldEntityType;
  @Input() values: Record<string, unknown> = {};
  @Input() disabled = false;
  @Input() showEmptyHint = false;

  @Output() valuesChange = new EventEmitter<Record<string, unknown>>();

  definitions: CustomFieldDefinition[] = [];
  isLoading = false;
  readonly Number = Number;

  constructor(private readonly api: CustomFieldsApiService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['entityType'] && this.entityType) {
      this.loadDefinitions();
    }
  }

  loadDefinitions() {
    this.isLoading = true;
    this.api.list(this.entityType).subscribe({
      next: (defs) => {
        this.definitions = (defs ?? [])
          .filter((d) => d.active)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        this.isLoading = false;
      },
      error: () => (this.isLoading = false),
    });
  }

  getValue(def: CustomFieldDefinition): unknown {
    const v = this.values?.[def.key];
    if (v === undefined || v === null) {
      return def.type === 'boolean' ? false : '';
    }
    return v;
  }

  setValue(key: string, value: unknown) {
    const next = { ...(this.values ?? {}), [key]: value };
    this.valuesChange.emit(next);
  }

  toDateInput(value: unknown): string {
    if (!value) return '';
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
