import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { ProjectTask, ProjectTaskDocument } from './schemas/project-task.schema';

@Injectable()
export class ProjectTasksService {
  constructor(
    @InjectModel(ProjectTask.name) private readonly taskModel: Model<ProjectTaskDocument>,
  ) {}

  async list(projectId: string) {
    return this.taskModel
      .find({ projectId: new Types.ObjectId(projectId), deletedAt: { $exists: false } })
      .populate('assignedTo', 'name email')
      .sort({ order: 1, createdAt: 1 });
  }

  async create(projectId: string, dto: CreateTaskDto, userId?: Types.ObjectId) {
    const order =
      dto.order ??
      (await this.taskModel.countDocuments({
        projectId: new Types.ObjectId(projectId),
        deletedAt: { $exists: false },
      }));
    const task = await this.taskModel.create({
      ...dto,
      projectId: new Types.ObjectId(projectId),
      assignedTo: dto.assignedTo ? new Types.ObjectId(dto.assignedTo) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      order,
      status: dto.status ?? 'todo',
      priority: dto.priority ?? 'medium',
      createdBy: userId,
      updatedBy: userId,
    });
    return task;
  }

  async update(taskId: string, dto: UpdateTaskDto, userId?: Types.ObjectId) {
    const update: Record<string, unknown> = {
      ...dto,
      updatedBy: userId,
    };
    if (dto.dueDate) {
      update.dueDate = new Date(dto.dueDate);
    }
    if (dto.assignedTo) {
      update.assignedTo = new Types.ObjectId(dto.assignedTo);
    }
    if (dto.status === 'done') {
      update.completedAt = new Date();
    } else if (dto.status) {
      update.completedAt = null;
    }
    const task = await this.taskModel.findOneAndUpdate(
      { _id: taskId, deletedAt: { $exists: false } },
      update,
      { new: true },
    );
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }

  async remove(taskId: string, userId?: Types.ObjectId) {
    const task = await this.taskModel.findOneAndUpdate(
      { _id: taskId, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!task) {
      throw new NotFoundException('Task not found');
    }
    return task;
  }
}
