import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type TemplateGroupDocument = HydratedDocument<TemplateGroup>;

@Schema({ timestamps: true })
export class TemplateGroup {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ default: 'slate' })
  color: string;

  @Prop({ default: 0 })
  order: number;

  @Prop({ default: false })
  isSystem: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const TemplateGroupSchema = SchemaFactory.createForClass(TemplateGroup);
