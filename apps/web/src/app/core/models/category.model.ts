export type CategoryItem = {
  _id: string;
  name: string;
  type: 'income' | 'expense';
  parentId?: string;
  createdAt?: string;
  updatedAt?: string;
};
