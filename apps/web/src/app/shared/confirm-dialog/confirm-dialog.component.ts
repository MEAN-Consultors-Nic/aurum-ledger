import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ConfirmService } from '../../core/services/confirm.service';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  template: `
    <ng-container *ngIf="state$ | async as state">
      <div *ngIf="state.open" class="fixed inset-0 z-[60] flex items-center justify-center px-4">
        <div class="absolute inset-0 bg-slate-900/60" (click)="confirm.cancel()"></div>
        <div class="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div class="text-lg font-semibold text-slate-900">{{ state.title }}</div>
          <div class="mt-3 text-sm text-slate-600">{{ state.message }}</div>
          <div class="mt-6 flex justify-end gap-3">
            <button
              type="button"
              class="rounded border border-slate-200 px-4 py-2 text-xs uppercase tracking-wide text-slate-700"
              (click)="confirm.cancel()"
            >
              {{ state.cancelText }}
            </button>
            <button
              type="button"
              class="rounded px-4 py-2 text-xs uppercase tracking-wide text-white"
              [ngClass]="state.danger ? 'bg-rose-600' : 'bg-slate-900'"
              (click)="confirm.confirm()"
            >
              {{ state.confirmText }}
            </button>
          </div>
        </div>
      </div>
    </ng-container>
  `,
})
export class ConfirmDialogComponent {
  readonly state$;

  constructor(readonly confirm: ConfirmService) {
    this.state$ = confirm.state$;
  }
}
