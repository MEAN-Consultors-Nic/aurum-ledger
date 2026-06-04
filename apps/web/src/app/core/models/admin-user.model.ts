export type AdminUser = {
  id: string;
  name: string;
  username?: string;
  email: string;
  role: 'admin' | 'staff';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};
