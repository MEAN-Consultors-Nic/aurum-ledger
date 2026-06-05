import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  VaultAccessLogEntry,
  VaultCategory,
  VaultCategoryCount,
  VaultCreatePayload,
  VaultEntry,
  VaultEntryRevealed,
  VaultUpdatePayload,
} from '../models/vault.model';

type ListOpts = {
  q?: string;
  category?: VaultCategory;
  tag?: string;
  favorite?: boolean;
};

@Injectable({ providedIn: 'root' })
export class VaultApiService {
  private readonly base = `${environment.apiUrl}/vault`;

  constructor(private readonly http: HttpClient) {}

  list(opts: ListOpts = {}) {
    let params = new HttpParams();
    if (opts.q) params = params.set('q', opts.q);
    if (opts.category) params = params.set('category', opts.category);
    if (opts.tag) params = params.set('tag', opts.tag);
    if (opts.favorite) params = params.set('favorite', 'true');
    return this.http.get<VaultEntry[]>(this.base, { params });
  }

  categoryCounts() {
    return this.http.get<VaultCategoryCount[]>(`${this.base}/categories`);
  }

  findOne(id: string) {
    return this.http.get<VaultEntry>(`${this.base}/${id}`);
  }

  reveal(id: string) {
    return this.http.post<VaultEntryRevealed>(`${this.base}/${id}/reveal`, {});
  }

  audit(id: string, limit = 25) {
    return this.http.get<VaultAccessLogEntry[]>(`${this.base}/${id}/audit`, {
      params: new HttpParams().set('limit', String(limit)),
    });
  }

  create(payload: VaultCreatePayload) {
    return this.http.post<VaultEntry>(this.base, payload);
  }

  update(id: string, payload: VaultUpdatePayload) {
    return this.http.patch<VaultEntry>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<{ _id: string; deleted: boolean }>(`${this.base}/${id}`);
  }
}
