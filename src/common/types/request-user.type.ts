import { Types } from 'mongoose';

export type RequestUser = {
  _id: Types.ObjectId;
  email: string;
  role: 'admin' | 'staff';
};
