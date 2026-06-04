export type SubscriptionItem = {
  _id: string;
  name: string;
  amount: number;
  currency: 'USD' | 'NIO';
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  daysOfMonth: number[];
  isActive: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SubscriptionOccurrence = {
  _id: string;
  subscriptionId: string | { _id: string; name: string };
  accountId: string | { _id: string; name: string; currency: 'USD' | 'NIO' };
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  date: string;
  amount: number;
  currency: 'USD' | 'NIO';
  status: 'planned' | 'confirmed' | 'omitted';
  confirmedTransactionId?: string;
  updatedAt?: string;
};

export type SubscriptionAlerts = {
  count: number;
  items: SubscriptionOccurrence[];
};
