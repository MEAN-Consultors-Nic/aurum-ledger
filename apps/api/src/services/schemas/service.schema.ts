import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ServiceDocument = HydratedDocument<Service>;

@Schema({ timestamps: true })
export class Service {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, enum: ['recurring', 'one_time'] })
  billingType: 'recurring' | 'one_time';

  @Prop({ enum: ['monthly', 'annual', 'one_time'] })
  defaultPeriod?: 'monthly' | 'annual' | 'one_time';

  @Prop()
  description?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  deletedAt?: Date;
}

export const ServiceSchema = SchemaFactory.createForClass(Service);
