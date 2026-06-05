import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';

export type SearchResultType =
  | 'client'
  | 'estimate'
  | 'contract'
  | 'project'
  | 'task'
  | 'service';

export type SearchResult = {
  type: SearchResultType;
  _id: string;
  label: string;
  subtitle: string;
  url: string;
};

@Injectable({ providedIn: 'root' })
export class SearchApiService {
  private readonly base = `${environment.apiUrl}/search`;

  constructor(private readonly http: HttpClient) {}

  search(q: string) {
    const params = new HttpParams().set('q', q);
    return this.http.get<{ results: SearchResult[] }>(this.base, { params });
  }
}
