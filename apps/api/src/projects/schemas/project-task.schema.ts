import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProjectTaskDocument = HydratedDocument<ProjectTask>;

@Schema({ timestamps: true })
export class ProjectTask {
  @Prop({ type: Types.ObjectId, ref: 'Project', required: true })
  projectId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({
    required: true,
    enum: ['todo', 'in_progress', 'blocked', 'done'],
    default: 'todo',
  })
  status: 'todo' | 'in_progress' | 'blocked' | 'done';

  @Prop({ required: true, enum: ['low', 'medium', 'high'], default: 'medium' })
  priority: 'low' | 'medium' | 'high';

  @Prop()
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ default: 0 })
  order: number;

  @Prop()
  completedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  updatedBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

export const ProjectTaskSchema = SchemaFactory.createForClass(ProjectTask);
ProjectTaskSchema.index({ projectId: 1, status: 1, order: 1 });
