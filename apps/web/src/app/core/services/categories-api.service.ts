import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { CategoryItem } from '../models/category.model';

@Injectable({ providedIn: 'root' })
export class CategoriesApiService {
  constructor(private readonly http: HttpClient) {}

  list(params?: { type?: string }) {
    let httpParams = new HttpParams();
    if (params?.type) {
      httpParams = httpParams.set('type', params.type);
    }
    return this.http.get<CategoryItem[]>(`${environment.apiUrl}/categories`, { params: httpParams });
  }

  create(payload: { name: string; type: 'income' | 'expense'; parentId?: string }) {
    return this.http.post<CategoryItem>(`${environment.apiUrl}/categories`, payload);
  }

  update(id: string, payload: Partial<CategoryItem>) {
    return this.http.patch<CategoryItem>(`${environment.apiUrl}/categories/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<CategoryItem>(`${environment.apiUrl}/categories/${id}`);
  }
}
