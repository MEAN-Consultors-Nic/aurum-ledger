import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProjectDocument = HydratedDocument<Project>;

@Schema({ _id: true, timestamps: true })
export class ProjectNote {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  body: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  createdAt?: Date;
  updatedAt?: Date;
}

@Schema({ _id: true, timestamps: true })
export class ProjectDeliverable {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  label: string;

  @Prop({ default: false })
  done: boolean;

  @Prop()
  doneAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  doneBy?: Types.ObjectId;

  @Prop()
  note?: string;

  createdAt?: Date;
  updatedAt?: Date;
}

@Schema({ timestamps: true })
export class Project {
  @Prop({ required: true })
  name: string;

  @Prop()
  description?: string;

  @Prop({ type: Types.ObjectId, ref: 'Contract', required: true, unique: true, sparse: true })
  contractId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Client', required: true })
  clientId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Service' })
  serviceId?: Types.ObjectId;

  @Prop({
    required: true,
    enum: ['active', 'on_hold', 'completed', 'archived'],
    default: 'active',
  })
  status: 'active' | 'on_hold' | 'completed' | 'archived';

  @Prop()
  startDate?: Date;

  @Prop()
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  @Prop({ type: [ProjectNote], default: [] })
  notes: ProjectNote[];

  @Prop({ type: [ProjectDeliverable], default: [] })
  deliverables: ProjectDeliverable[];

  @Prop()
  templateKey?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;

  // ----- Client-portal share link -----
  @Prop()
  shareToken?: string;

  @Prop()
  shareCreatedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  shareCreatedBy?: Types.ObjectId;

  @Prop()
  shareRevokedAt?: Date;

  @Prop({ default: 0 })
  shareViewCount: number;

  @Prop()
  shareLastViewedAt?: Date;
}

export const ProjectSchema = SchemaFactory.createForClass(Project);
ProjectSchema.index({ clientId: 1, status: 1 });
ProjectSchema.index({ status: 1, dueDate: 1 });
ProjectSchema.index({ shareToken: 1 }, { unique: true, sparse: true });
