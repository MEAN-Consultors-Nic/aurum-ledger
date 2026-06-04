export type AccountItem = {
  _id: string;
  name: string;
  type: 'bank' | 'paypal' | 'cash' | 'other';
  currency: 'USD' | 'NIO';
  bankName?: string;
  initialBalance: number;
  currentBalance?: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};
