import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class RequestLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request & { headers: Record<string, string> }>();
    const response = http.getResponse<Response & { statusCode: number }>();
    const { method, url, headers } = request as unknown as {
      method: string;
      url: string;
      headers: Record<string, string>;
    };
    const correlationId = headers['x-correlation-id'] ?? 'n/a';
    const start = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - start;
        this.logger.log(
          `${method} ${url} ${response.statusCode} ${duration}ms cid=${correlationId}`,
        );
      }),
    );
  }
}
