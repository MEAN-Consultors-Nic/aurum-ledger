import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttachmentItem,
  AttachmentParentType,
  PresignResponse,
} from '../models/attachment.model';

export type UploadProgress =
  | { kind: 'progress'; loaded: number; total: number }
  | { kind: 'done'; attachment: AttachmentItem };

@Injectable({ providedIn: 'root' })
export class AttachmentsApiService {
  private readonly base = `${environment.apiUrl}/attachments`;

  constructor(private readonly http: HttpClient) {}

  list(parentType: AttachmentParentType, parentId: string) {
    const params = new HttpParams()
      .set('parentType', parentType)
      .set('parentId', parentId);
    return this.http.get<AttachmentItem[]>(this.base, { params });
  }

  remove(id: string) {
    return this.http.delete<{ deleted: boolean }>(`${this.base}/${id}`);
  }

  /** Asks the API for a fresh presigned GET URL (10-min TTL). */
  download(id: string) {
    return this.http.get<{ url: string; filename: string; mimeType: string }>(
      `${this.base}/${id}/download`,
    );
  }

  /**
   * Full upload flow:
   *   1. POST /presign     → reserve row + presigned PUT
   *   2. PUT bytes to S3 directly
   *   3. POST /:id/complete → flip status to 'uploaded'
   * Emits HTTP progress events for the S3 PUT.
   */
  upload(
    file: File,
    parentType: AttachmentParentType,
    parentId: string,
  ): Observable<UploadProgress> {
    return new Observable<UploadProgress>((subscriber) => {
      const presignPayload = {
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        sizeBytes: file.size,
        parentType,
        parentId,
      };
      const sub = this.http
        .post<PresignResponse>(`${this.base}/presign`, presignPayload)
        .pipe(
          switchMap((presign) =>
            this.http
              .put(presign.uploadUrl, file, {
                headers: presign.headers,
                reportProgress: true,
                observe: 'events',
              })
              .pipe(
                switchMap((event: HttpEvent<unknown>) => {
                  if (event.type === HttpEventType.UploadProgress) {
                    subscriber.next({
                      kind: 'progress',
                      loaded: event.loaded,
                      total: event.total ?? file.size,
                    });
                    return [];
                  }
                  if (event.type === HttpEventType.Response) {
                    return this.http.post<AttachmentItem>(
                      `${this.base}/${presign.attachmentId}/complete`,
                      {},
                    );
                  }
                  return [];
                }),
              ),
          ),
        )
        .subscribe({
          next: (attachment) => {
            if (attachment && (attachment as AttachmentItem)._id) {
              subscriber.next({ kind: 'done', attachment: attachment as AttachmentItem });
              subscriber.complete();
            }
          },
          error: (err) => subscriber.error(err),
        });
      return () => sub.unsubscribe();
    });
  }
}
