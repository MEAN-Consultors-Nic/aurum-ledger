import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { AssetItem, AssetType } from '../models/asset.model';

@Injectable({ providedIn: 'root' })
export class AssetsApiService {
  private readonly base = `${environment.apiUrl}/assets`;

  constructor(private readonly http: HttpClient) {}

  list() {
    return this.http.get<AssetItem[]>(this.base);
  }

  create(payload: {
    name: string;
    type: AssetType;
    currency: 'USD' | 'NIO';
    currentValue: number;
    notes?: string;
  }) {
    return this.http.post<AssetItem>(this.base, payload);
  }

  update(
    id: string,
    payload: Partial<{
      name: string;
      type: AssetType;
      currency: 'USD' | 'NIO';
      currentValue: number;
      notes?: string;
    }>,
  ) {
    return this.http.patch<AssetItem>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<AssetItem>(`${this.base}/${id}`);
  }
}
