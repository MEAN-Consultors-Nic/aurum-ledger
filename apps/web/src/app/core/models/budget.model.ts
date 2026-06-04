export type BudgetItem = {
  _id: string;
  categoryId: string | { _id: string; name: string; type: 'income' | 'expense' };
  month: number;
  year: number;
  amount: number;
  currency: 'USD' | 'NIO';
  createdAt?: string;
  updatedAt?: string;
};
