export type ServiceItem = {
  _id: string;
  name: string;
  billingType: 'recurring' | 'one_time';
  defaultPeriod?: 'monthly' | 'annual' | 'one_time';
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};
