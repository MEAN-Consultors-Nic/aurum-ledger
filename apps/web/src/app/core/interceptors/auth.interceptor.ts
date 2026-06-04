import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getAccessToken();

  const request = token
    ? req.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      })
    : req;

  const response$ = next(request) as any;
  return response$.pipe(
    (catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        authService.clearSession();
        if (router.url !== '/login') {
          router.navigate(['/login'], { queryParams: { reason: 'expired' } });
        }
      }
      return throwError(() => error);
    }) as any),
  ) as any;
};
