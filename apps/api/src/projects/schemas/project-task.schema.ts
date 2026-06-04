import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ProjectTaskDocument = HydratedDocument<ProjectTask>;

@Schema({ _id: true })
export class ChecklistItem {
  _id?: Types.ObjectId;

  @Prop({ required: true })
  text: string;

  @Prop({ default: false })
  done: boolean;

  @Prop()
  doneAt?: Date;
}
export const ChecklistItemSchema = SchemaFactory.createForClass(ChecklistItem);

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
  startDate?: Date;

  @Prop()
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  assignedTo?: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: [ChecklistItemSchema], default: [] })
  checklist: ChecklistItem[];

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
