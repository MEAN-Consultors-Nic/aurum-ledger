import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

export type ConfirmState = {
  open: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  danger: boolean;
};

@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly stateSubject = new BehaviorSubject<ConfirmState>({
    open: false,
    title: 'Confirm action',
    message: '',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    danger: false,
  });

  private resolver: ((value: boolean) => void) | null = null;

  readonly state$ = this.stateSubject.asObservable();

  open(options: ConfirmOptions) {
    const state: ConfirmState = {
      open: true,
      title: options.title ?? 'Confirm action',
      message: options.message,
      confirmText: options.confirmText ?? 'Confirm',
      cancelText: options.cancelText ?? 'Cancel',
      danger: options.danger ?? false,
    };
    this.stateSubject.next(state);

    return new Promise<boolean>((resolve) => {
      this.resolver = resolve;
    });
  }

  confirm() {
    if (this.resolver) {
      this.resolver(true);
    }
    this.resolver = null;
    this.close();
  }

  cancel() {
    if (this.resolver) {
      this.resolver(false);
    }
    this.resolver = null;
    this.close();
  }

  private close() {
    this.stateSubject.next({
      open: false,
      title: 'Confirm action',
      message: '',
      confirmText: 'Confirm',
      cancelText: 'Cancel',
      danger: false,
    });
  }
}
