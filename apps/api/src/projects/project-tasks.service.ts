import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ChecklistItemDto,
  CreateTaskDto,
  MoveTaskDto,
  UpdateChecklistItemDto,
  UpdateTaskDto,
} from './dto/task.dto';
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
    const status = dto.status ?? 'todo';
    // Place new tasks at the end of the column they land in.
    const order =
      dto.order ??
      (await this.taskModel.countDocuments({
        projectId: new Types.ObjectId(projectId),
        status,
        deletedAt: { $exists: false },
      }));
    const task = await this.taskModel.create({
      ...dto,
      projectId: new Types.ObjectId(projectId),
      assignedTo: dto.assignedTo ? new Types.ObjectId(dto.assignedTo) : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      tags: dto.tags ?? [],
      checklist: [],
      order,
      status,
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
    if (dto.startDate !== undefined) {
      update.startDate = dto.startDate ? new Date(dto.startDate) : null;
    }
    if (dto.dueDate !== undefined) {
      update.dueDate = dto.dueDate ? new Date(dto.dueDate) : null;
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

  /**
   * Atomic Kanban move: places the task into a column at a given order and
   * re-numbers every task in both the source and destination columns so
   * ordering stays dense (0..n-1).
   */
  async move(taskId: string, dto: MoveTaskDto, userId?: Types.ObjectId) {
    const task = await this.taskModel.findOne({
      _id: taskId,
      deletedAt: { $exists: false },
    });
    if (!task) {
      throw new NotFoundException('Task not found');
    }

    const fromStatus = task.status;
    const projectId = task.projectId;
    const toStatus = dto.status;

    // Snapshot every task in both columns we're touching.
    const sourceTasks =
      fromStatus === toStatus
        ? []
        : await this.taskModel
            .find({
              projectId,
              status: fromStatus,
              deletedAt: { $exists: false },
              _id: { $ne: task._id },
            })
            .sort({ order: 1, createdAt: 1 });

    const destTasks = await this.taskModel
      .find({
        projectId,
        status: toStatus,
        deletedAt: { $exists: false },
        _id: { $ne: task._id },
      })
      .sort({ order: 1, createdAt: 1 });

    const clampedIndex = Math.max(0, Math.min(dto.order, destTasks.length));
    const newDest = [...destTasks];
    newDest.splice(clampedIndex, 0, task);

    // Apply: update the moved task itself (status + order + audit fields)
    // and re-number the source/dest columns.
    const writes: Promise<unknown>[] = [];
    task.status = toStatus;
    task.order = clampedIndex;
    task.updatedBy = userId;
    if (toStatus === 'done' && fromStatus !== 'done') {
      task.completedAt = new Date();
    } else if (toStatus !== 'done') {
      task.completedAt = undefined;
    }
    writes.push(task.save());

    newDest.forEach((t, idx) => {
      if (t._id.equals(task._id)) return; // already saved above
      if (t.order !== idx) {
        writes.push(this.taskModel.updateOne({ _id: t._id }, { $set: { order: idx } }));
      }
    });
    sourceTasks.forEach((t, idx) => {
      if (t.order !== idx) {
        writes.push(this.taskModel.updateOne({ _id: t._id }, { $set: { order: idx } }));
      }
    });

    await Promise.all(writes);
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

  // ----- Checklist -----

  async addChecklistItem(taskId: string, dto: ChecklistItemDto, userId?: Types.ObjectId) {
    const task = await this.taskModel.findOne({
      _id: taskId,
      deletedAt: { $exists: false },
    });
    if (!task) throw new NotFoundException('Task not found');
    task.checklist.push({ text: dto.text.trim(), done: false } as any);
    task.updatedBy = userId;
    await task.save();
    return task;
  }

  async updateChecklistItem(
    taskId: string,
    itemId: string,
    dto: UpdateChecklistItemDto,
    userId?: Types.ObjectId,
  ) {
    const task = await this.taskModel.findOne({
      _id: taskId,
      deletedAt: { $exists: false },
    });
    if (!task) throw new NotFoundException('Task not found');
    const item = (task.checklist as any[]).find((c) => c._id?.toString() === itemId);
    if (!item) throw new NotFoundException('Checklist item not found');
    if (dto.text !== undefined) item.text = dto.text.trim();
    if (dto.done !== undefined) {
      item.done = dto.done;
      item.doneAt = dto.done ? new Date() : undefined;
    }
    task.updatedBy = userId;
    await task.save();
    return task;
  }

  async removeChecklistItem(taskId: string, itemId: string, userId?: Types.ObjectId) {
    const task = await this.taskModel.findOne({
      _id: taskId,
      deletedAt: { $exists: false },
    });
    if (!task) throw new NotFoundException('Task not found');
    task.checklist = (task.checklist as any[]).filter(
      (c) => c._id?.toString() !== itemId,
    );
    task.updatedBy = userId;
    await task.save();
    return task;
  }
}
