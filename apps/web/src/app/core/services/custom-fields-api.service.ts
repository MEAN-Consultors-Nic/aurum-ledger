import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import {
  CreateCustomFieldPayload,
  CustomFieldDefinition,
  CustomFieldEntityType,
  UpdateCustomFieldPayload,
} from '../models/custom-field.model';

@Injectable({ providedIn: 'root' })
export class CustomFieldsApiService {
  private readonly base = `${environment.apiUrl}/custom-fields`;

  constructor(private readonly http: HttpClient) {}

  list(entityType?: CustomFieldEntityType) {
    let params = new HttpParams();
    if (entityType) params = params.set('entityType', entityType);
    return this.http.get<CustomFieldDefinition[]>(this.base, { params });
  }

  create(payload: CreateCustomFieldPayload) {
    return this.http.post<CustomFieldDefinition>(this.base, payload);
  }

  update(id: string, payload: UpdateCustomFieldPayload) {
    return this.http.patch<CustomFieldDefinition>(`${this.base}/${id}`, payload);
  }

  remove(id: string) {
    return this.http.delete<CustomFieldDefinition>(`${this.base}/${id}`);
  }
}
