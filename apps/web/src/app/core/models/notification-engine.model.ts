export type EventCategory =
  | 'contract'
  | 'payment'
  | 'project'
  | 'income'
  | 'expense'
  | 'budget'
  | 'estimate'
  | 'misc';

export type PlaceholderSpec = {
  path: string;
  description: string;
  example?: string;
};

export type EventDefinition = {
  key: string;
  label: string;
  description: string;
  category: EventCategory;
  placeholders: PlaceholderSpec[];
  defaultRecipients: string[];
  conditions?: Array<{ key: string; label: string; type: 'number' | 'string' | 'boolean' }>;
};

export type TemplateGroup = {
  _id: string;
  name: string;
  description?: string;
  color: string;
  order: number;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationTemplate = {
  _id: string;
  groupId?: string | { _id: string; name: string; color: string };
  name: string;
  description?: string;
  channel: 'email';
  eventKey?: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  isActive: boolean;
  isSystem: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationRule = {
  _id: string;
  name: string;
  eventKey: string;
  templateId: string | { _id: string; name: string; subject: string };
  recipients: string[];
  conditions: Record<string, unknown>;
  enabled: boolean;
  isSystem: boolean;
  lastTriggeredAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationLogEntry = {
  _id: string;
  eventKey?: string;
  ruleId?: string;
  templateId?: string;
  contextRef?: string;
  recipient: string;
  subject: string;
  bodyHtml?: string;
  status: 'queued' | 'sent' | 'failed' | 'skipped';
  error?: string;
  sentAt?: string;
  dedupeKey?: string;
  createdAt?: string;
};

export type RenderPreview = {
  subject: string;
  html: string;
  text: string;
};

export type SendTestResult =
  | { ok: true; messageId: string; provider: string }
  | { ok: false; provider: string; reason: string };
