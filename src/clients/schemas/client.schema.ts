import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ClientDocument = HydratedDocument<Client>;

@Schema({ timestamps: true })
export class Client {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  contactName?: string;

  @Prop({ lowercase: true, trim: true })
  email?: string;

  @Prop()
  phone?: string;

  @Prop()
  notes?: string;

  @Prop({ type: [String], default: [] })
  tags?: string[];

  @Prop({ default: true })
  isActive: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const ClientSchema = SchemaFactory.createForClass(Client);
ClientSchema.index({ name: 1 });
