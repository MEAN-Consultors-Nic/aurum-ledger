import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CustomFieldDocument = HydratedDocument<CustomField>;

export type CustomFieldEntityType =
  | 'client'
  | 'project'
  | 'contract'
  | 'estimate'
  | 'task'
  | 'service';

export type CustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'boolean'
  | 'select'
  | 'url';

@Schema({ timestamps: true })
export class CustomField {
  @Prop({
    required: true,
    enum: ['client', 'project', 'contract', 'estimate', 'task', 'service'],
  })
  entityType: CustomFieldEntityType;

  /** Machine key — used inside customValues[].  Unique per entityType. */
  @Prop({ required: true, trim: true })
  key: string;

  /** Display label. */
  @Prop({ required: true, trim: true })
  label: string;

  @Prop({
    required: true,
    enum: ['text', 'textarea', 'number', 'date', 'boolean', 'select', 'url'],
  })
  type: CustomFieldType;

  /** Options for select type. */
  @Prop({ type: [String], default: [] })
  options: string[];

  @Prop({ default: false })
  required: boolean;

  /** Default applied when reading a doc that has no value yet. */
  @Prop({ type: Object })
  defaultValue?: unknown;

  @Prop()
  placeholder?: string;

  @Prop()
  helpText?: string;

  /** Display order within the entity's custom fields section. */
  @Prop({ default: 0 })
  order: number;

  /** Soft-disable — keeps stored values but hides the field. */
  @Prop({ default: true })
  active: boolean;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const CustomFieldSchema = SchemaFactory.createForClass(CustomField);
CustomFieldSchema.index({ entityType: 1, key: 1 }, { unique: true });
CustomFieldSchema.index({ entityType: 1, order: 1 });
