import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  Input,
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type ActionMenuItem = {
  label: string;
  action: () => void;
  danger?: boolean;
  disabled?: boolean;
};

@Component({
  selector: 'app-action-menu',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-block text-left">
      <button
        type="button"
        class="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
        [class.bg-slate-100]="isOpen"
        [class.text-slate-900]="isOpen"
        [attr.aria-expanded]="isOpen"
        aria-haspopup="menu"
        aria-label="Actions"
        (click)="toggle($event)"
      >
        <svg viewBox="0 0 16 16" class="h-4 w-4" fill="currentColor" aria-hidden="true">
          <circle cx="8" cy="3" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="8" cy="13" r="1.5" />
        </svg>
      </button>

      <div
        *ngIf="isOpen"
        role="menu"
        class="absolute right-0 z-50 mt-1 w-44 origin-top-right rounded-md border border-slate-200 bg-white py-1 shadow-lg ring-1 ring-black/5"
      >
        <ng-container *ngFor="let item of visibleItems()">
          <button
            type="button"
            role="menuitem"
            class="block w-full px-3 py-2 text-left text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-40"
            [ngClass]="item.danger
              ? 'text-rose-600 hover:bg-rose-50 hover:text-rose-700'
              : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'"
            [disabled]="!!item.disabled"
            (click)="handle(item, $event)"
          >
            {{ item.label }}
          </button>
        </ng-container>
      </div>
    </div>
  `,
})
export class ActionMenuComponent {
  @Input() items: ActionMenuItem[] = [];
  isOpen = false;

  constructor(private readonly host: ElementRef<HTMLElement>) {}

  visibleItems() {
    return (this.items || []).filter(Boolean);
  }

  toggle(event: MouseEvent) {
    event.stopPropagation();
    this.isOpen = !this.isOpen;
  }

  handle(item: ActionMenuItem, event: MouseEvent) {
    event.stopPropagation();
    if (item.disabled) {
      return;
    }
    this.isOpen = false;
    item.action();
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    if (!this.isOpen) {
      return;
    }
    if (!this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.isOpen = false;
  }
}
