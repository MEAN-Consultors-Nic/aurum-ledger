export type AssetType =
  | 'real_estate'
  | 'vehicle'
  | 'investment'
  | 'retirement'
  | 'crypto'
  | 'cash_equivalent'
  | 'receivable'
  | 'other';

export type AssetItem = {
  _id: string;
  name: string;
  type: AssetType;
  currency: 'USD' | 'NIO';
  currentValue: number;
  notes?: string;
  lastValuationAt?: string;
  createdAt?: string;
  updatedAt?: string;
};
