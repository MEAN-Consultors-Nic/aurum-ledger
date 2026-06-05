export type CustomFieldEntityType =
  | 'client'
  | 'project'
  | 'contract'
  | 'estimate'
  | 'task'
  | 'service';

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'url';

export type CustomFieldDefinition = {
  _id: string;
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
  order: number;
  active: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateCustomFieldPayload = {
  entityType: CustomFieldEntityType;
  key: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  defaultValue?: unknown;
  placeholder?: string;
  helpText?: string;
  order?: number;
  active?: boolean;
};

export type UpdateCustomFieldPayload = Partial<Omit<CreateCustomFieldPayload, 'entityType' | 'key'>>;

export const ENTITY_TYPE_OPTIONS: { value: CustomFieldEntityType; label: string }[] = [
  { value: 'client', label: 'Clients' },
  { value: 'project', label: 'Projects' },
  { value: 'contract', label: 'Contracts' },
  { value: 'estimate', label: 'Estimates' },
  { value: 'task', label: 'Tasks' },
  { value: 'service', label: 'Services' },
];

export const FIELD_TYPE_OPTIONS: { value: CustomFieldType; label: string }[] = [
  { value: 'text', label: 'Text (single line)' },
  { value: 'textarea', label: 'Text (multiline)' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'select', label: 'Dropdown' },
  { value: 'url', label: 'URL' },
];
