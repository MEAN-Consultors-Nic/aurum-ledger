export const VAULT_CATEGORIES = [
  'personal',
  'banking',
  'email',
  'server',
  'service',
  'wifi',
  'client',
  'other',
] as const;
export type VaultCategory = (typeof VAULT_CATEGORIES)[number];

export const VAULT_CATEGORY_LABELS: Record<VaultCategory, string> = {
  personal: 'Personal',
  banking: 'Banking',
  email: 'Email',
  server: 'Server',
  service: 'Service / API',
  wifi: 'Wi-Fi',
  client: 'Client',
  other: 'Other',
};

export type VaultEntry = {
  _id: string;
  name: string;
  category: VaultCategory;
  tags: string[];
  url?: string;
  username?: string;
  notes?: string;
  parentType?: 'project' | 'client' | 'contract' | 'service' | null;
  parentId?: string | null;
  favorite: boolean;
  lastAccessedAt?: string;
  accessCount: number;
  createdAt?: string;
  updatedAt?: string;
};

export type VaultEntryRevealed = VaultEntry & {
  fields: Record<string, unknown>;
};

export type VaultCategoryCount = {
  category: VaultCategory | 'all';
  count: number;
};

export type VaultAccessLogEntry = {
  _id: string;
  entryId: string;
  userId?: { _id: string; name?: string; email?: string } | string;
  action: 'view' | 'create' | 'update' | 'delete';
  ip?: string;
  userAgent?: string;
  createdAt: string;
};

export type VaultCreatePayload = {
  name: string;
  category: VaultCategory;
  tags?: string[];
  url?: string;
  username?: string;
  notes?: string;
  fields: Record<string, unknown>;
  favorite?: boolean;
};

export type VaultUpdatePayload = Partial<Omit<VaultCreatePayload, 'fields'>> & {
  fields?: Record<string, unknown>;
};
