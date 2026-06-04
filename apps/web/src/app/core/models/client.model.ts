export type ClientItem = {
  _id: string;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  notes?: string;
  tags?: string[];
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type ClientListResponse = {
  items: ClientItem[];
  total: number;
  page: number;
  limit: number;
};
