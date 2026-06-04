import { Injectable, Logger, NotFoundException } from '@nestjs/common';
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
  private readonly logger = new Logger(ProjectTasksService.name);

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
   * Atomic Kanban move: writes the task's new status + order via an explicit
   * $set, then renumbers source and destination columns so ordering stays
   * dense (0..n-1). Uses findOneAndUpdate so we never depend on the document
   * snapshot's dirty-tracking surviving across awaits.
   */
  async move(taskId: string, dto: MoveTaskDto, userId?: Types.ObjectId) {
    this.logger.log(
      `move() in: taskId=${taskId} status=${dto.status} order=${dto.order}`,
    );
    const existing = await this.taskModel.findOne({
      _id: taskId,
      deletedAt: { $exists: false },
    });
    if (!existing) {
      this.logger.warn(`move(): task ${taskId} not found`);
      throw new NotFoundException('Task not found');
    }

    const fromStatus = existing.status;
    const toStatus = dto.status;
    const projectId = existing.projectId;
    this.logger.log(`move(): fromStatus=${fromStatus} toStatus=${toStatus}`);

    // Pull the destination column (excluding the task we're moving) so we
    // can clamp the requested index.
    const destTasks = await this.taskModel
      .find({
        projectId,
        status: toStatus,
        deletedAt: { $exists: false },
        _id: { $ne: existing._id },
      })
      .sort({ order: 1, createdAt: 1 });

    const clampedIndex = Math.max(0, Math.min(dto.order, destTasks.length));

    // ---- The move itself: explicit atomic $set ----
    const setFields: Record<string, unknown> = {
      status: toStatus,
      order: clampedIndex,
      updatedBy: userId,
    };
    const unsetFields: Record<string, unknown> = {};
    if (toStatus === 'done' && fromStatus !== 'done') {
      setFields.completedAt = new Date();
    } else if (toStatus !== 'done') {
      unsetFields.completedAt = 1;
    }

    const update: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length > 0) {
      update.$unset = unsetFields;
    }

    const moved = await this.taskModel.findOneAndUpdate(
      { _id: taskId, deletedAt: { $exists: false } },
      update,
      { new: true },
    );
    if (!moved) {
      throw new NotFoundException('Task not found after move');
    }
    this.logger.log(
      `move(): persisted task ${taskId} now status=${moved.status} order=${moved.order}`,
    );
    // Verification read — confirms what's actually on disk.
    const verify = await this.taskModel.findById(taskId).lean();
    this.logger.log(`move(): verify read status=${verify?.status} order=${verify?.order}`);

    // ---- Renumber columns to keep ordering dense ----
    const reorderPromises: Promise<unknown>[] = [];
    const newDest = [...destTasks];
    newDest.splice(clampedIndex, 0, moved);
    newDest.forEach((t, idx) => {
      if (t._id.equals(moved._id)) return; // already at clampedIndex via $set above
      if (t.order !== idx) {
        reorderPromises.push(
          this.taskModel.updateOne({ _id: t._id }, { $set: { order: idx } }),
        );
      }
    });
    if (fromStatus !== toStatus) {
      const sourceTasks = await this.taskModel
        .find({
          projectId,
          status: fromStatus,
          deletedAt: { $exists: false },
          _id: { $ne: moved._id },
        })
        .sort({ order: 1, createdAt: 1 });
      sourceTasks.forEach((t, idx) => {
        if (t.order !== idx) {
          reorderPromises.push(
            this.taskModel.updateOne({ _id: t._id }, { $set: { order: idx } }),
          );
        }
      });
    }
    await Promise.all(reorderPromises);
    return moved;
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
