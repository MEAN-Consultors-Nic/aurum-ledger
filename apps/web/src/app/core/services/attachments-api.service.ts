import { Injectable } from '@angular/core';
import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AttachmentItem,
  AttachmentParentType,
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

  /** GET /:id/download → JSON {url, filename}. Frontend opens the URL. */
  download(id: string) {
    return this.http.get<{ url: string; filename: string; mimeType: string }>(
      `${this.base}/${id}/download`,
    );
  }

  /**
   * Server-side upload: multipart POST to the API; the API does the actual
   * S3 PutObject. Emits progress events for the browser→API leg of the trip.
   */
  upload(
    file: File,
    parentType: AttachmentParentType,
    parentId: string,
  ): Observable<UploadProgress> {
    return new Observable<UploadProgress>((subscriber) => {
      const form = new FormData();
      form.append('file', file, file.name);
      form.append('parentType', parentType);
      form.append('parentId', parentId);

      const sub = this.http
        .post<AttachmentItem>(this.base, form, {
          reportProgress: true,
          observe: 'events',
        })
        .subscribe({
          next: (event: HttpEvent<AttachmentItem>) => {
            if (event.type === HttpEventType.UploadProgress) {
              subscriber.next({
                kind: 'progress',
                loaded: event.loaded,
                total: event.total ?? file.size,
              });
            } else if (event.type === HttpEventType.Response && event.body) {
              subscriber.next({ kind: 'done', attachment: event.body });
              subscriber.complete();
            }
          },
          error: (err) => subscriber.error(err),
        });
      return () => sub.unsubscribe();
    });
  }
}
