export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export type ProjectParty = { _id: string; name: string };

export type ProjectContractRef = {
  _id: string;
  title?: string;
  amount?: number;
  currency?: 'USD' | 'NIO';
  status?: 'active' | 'expired' | 'cancelled';
  startDate?: string;
  endDate?: string;
};

export type ProjectNote = {
  _id: string;
  title: string;
  body: string;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectDeliverable = {
  _id: string;
  label: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
  note?: string;
};

export type ProjectItem = {
  _id: string;
  name: string;
  description?: string;
  contractId: string | ProjectContractRef;
  clientId: string | ProjectParty;
  serviceId?: string | ProjectParty;
  status: ProjectStatus;
  startDate?: string;
  dueDate?: string;
  assignedTo?: string | ProjectParty;
  tags: string[];
  progress: number;
  notes: ProjectNote[];
  deliverables: ProjectDeliverable[];
  templateKey?: string;
  taskTotal?: number;
  taskDone?: number;
  createdAt?: string;
  updatedAt?: string;
  shareToken?: string;
  shareCreatedAt?: string;
  shareRevokedAt?: string;
  shareViewCount?: number;
  shareLastViewedAt?: string;
};

export type ProjectTask = {
  _id: string;
  projectId: string;
  title: string;
  description?: string;
  status: 'todo' | 'in_progress' | 'blocked' | 'done';
  priority: 'low' | 'medium' | 'high';
  dueDate?: string;
  assignedTo?: string | ProjectParty;
  order: number;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectCredential = {
  _id: string;
  projectId: string;
  type: string;
  name: string;
  fields: Record<string, unknown>;
  notes?: string;
  lastAccessedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type ProjectTemplateSummary = {
  key: string;
  label: string;
  taskCount: number;
  deliverableCount: number;
  suggestedCredentials: Array<{ type: string; name: string }>;
};
