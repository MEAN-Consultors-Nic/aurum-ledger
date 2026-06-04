import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceDocument,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { ProjectTask, ProjectTaskDocument } from '../projects/schemas/project-task.schema';
import { NotificationsEngineService } from './notifications-engine.service';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class NotificationsSchedulerService {
  private readonly logger = new Logger(NotificationsSchedulerService.name);

  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectTask.name) private readonly taskModel: Model<ProjectTaskDocument>,
    @InjectModel(PlannedIncomeOccurrence.name)
    private readonly plannedOccurrenceModel: Model<PlannedIncomeOccurrenceDocument>,
    private readonly engine: NotificationsEngineService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async run() {
    this.logger.log('Running notification triggers');
    try {
      await Promise.all([
        this.runContractExpiringSoon(),
        this.runContractExpired(),
        this.runPaymentOverdue(),
        this.runProjectDueSoon(),
        this.runProjectTaskOverdue(),
        this.runPlannedIncomeOverdue(),
      ]);
    } catch (err) {
      this.logger.error(`Trigger run failed: ${(err as Error).message}`);
    }
  }

  // ===== Contract expiring soon (any active, non-omitted, non-cancelled) =====
  private async runContractExpiringSoon() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 60 * DAY_MS);
    const contracts = await this.contractModel
      .find({
        deletedAt: { $exists: false },
        paymentOmittedAt: { $exists: false },
        status: { $ne: 'cancelled' },
        endDate: { $gte: now, $lte: horizon },
      })
      .populate('clientId', 'name email')
      .populate('serviceId', 'name');

    for (const contract of contracts) {
      if (!contract.endDate) continue;
      const daysUntilExpiry = Math.ceil((contract.endDate.getTime() - now.getTime()) / DAY_MS);
      if (daysUntilExpiry < 0) continue;
      const dedupeDay = this.dayKey(now);
      const projectId = await this.findProjectId(contract._id as Types.ObjectId);
      await this.engine.dispatch({
        eventKey: 'contract.expiring_soon',
        contextRef: `contract:${contract._id}`,
        dedupeKey: `contract.expiring_soon:${contract._id}:${daysUntilExpiry}:${dedupeDay}`,
        contractId: contract._id as Types.ObjectId,
        clientId: contract.clientId as unknown as Types.ObjectId,
        projectId,
        context: {
          client: contract.clientId,
          contract: this.contractCtx(contract),
          service: contract.serviceId,
          daysUntilExpiry,
        },
      });
    }
  }

  // ===== Contract expired (endDate just passed, balance still open) =====
  private async runContractExpired() {
    const now = new Date();
    const cutoff = new Date(now.getTime() - 7 * DAY_MS);
    const contracts = await this.contractModel
      .find({
        deletedAt: { $exists: false },
        paymentOmittedAt: { $exists: false },
        status: { $ne: 'cancelled' },
        endDate: { $lt: now, $gte: cutoff },
      })
      .populate('clientId', 'name email')
      .populate('serviceId', 'name');

    for (const contract of contracts) {
      if (!contract.endDate) continue;
      const daysOverdue = Math.ceil((now.getTime() - contract.endDate.getTime()) / DAY_MS);
      const projectId = await this.findProjectId(contract._id as Types.ObjectId);
      await this.engine.dispatch({
        eventKey: 'contract.expired',
        contextRef: `contract:${contract._id}`,
        dedupeKey: `contract.expired:${contract._id}`,
        contractId: contract._id as Types.ObjectId,
        clientId: contract.clientId as unknown as Types.ObjectId,
        projectId,
        context: {
          client: contract.clientId,
          contract: this.contractCtx(contract),
          service: contract.serviceId,
          daysOverdue,
        },
      });
    }
  }

  // ===== Payment overdue (open balance, past endDate) =====
  private async runPaymentOverdue() {
    const now = new Date();
    const contracts = await this.contractModel
      .find({
        deletedAt: { $exists: false },
        paymentOmittedAt: { $exists: false },
        status: { $ne: 'cancelled' },
        endDate: { $lt: now },
      })
      .populate('clientId', 'name email')
      .populate('serviceId', 'name');

    for (const contract of contracts) {
      const balance = contract.amount - contract.paidTotal;
      if (balance <= 0) continue;
      if (!contract.endDate) continue;
      const daysOverdue = Math.ceil((now.getTime() - contract.endDate.getTime()) / DAY_MS);
      const dedupeDay = this.dayKey(now);
      const projectId = await this.findProjectId(contract._id as Types.ObjectId);
      await this.engine.dispatch({
        eventKey: 'payment.overdue',
        contextRef: `contract:${contract._id}`,
        dedupeKey: `payment.overdue:${contract._id}:${dedupeDay}`,
        contractId: contract._id as Types.ObjectId,
        clientId: contract.clientId as unknown as Types.ObjectId,
        projectId,
        context: {
          client: contract.clientId,
          contract: this.contractCtx(contract),
          balance,
          daysOverdue,
        },
      });
    }
  }

  // ===== Project due soon =====
  private async runProjectDueSoon() {
    const now = new Date();
    const horizon = new Date(now.getTime() + 14 * DAY_MS);
    const projects = await this.projectModel
      .find({
        deletedAt: { $exists: false },
        status: 'active',
        dueDate: { $gte: now, $lte: horizon },
      })
      .populate('clientId', 'name email');

    for (const project of projects) {
      if (!project.dueDate) continue;
      const daysUntilDue = Math.ceil((project.dueDate.getTime() - now.getTime()) / DAY_MS);
      const dedupeDay = this.dayKey(now);
      await this.engine.dispatch({
        eventKey: 'project.due_soon',
        contextRef: `project:${project._id}`,
        dedupeKey: `project.due_soon:${project._id}:${daysUntilDue}:${dedupeDay}`,
        projectId: project._id as Types.ObjectId,
        clientId: project.clientId as unknown as Types.ObjectId,
        context: {
          client: project.clientId,
          project: { name: project.name, dueDate: project.dueDate },
          daysUntilDue,
        },
      });
    }
  }

  // ===== Project task overdue =====
  private async runProjectTaskOverdue() {
    const now = new Date();
    const tasks = await this.taskModel
      .find({
        deletedAt: { $exists: false },
        status: { $in: ['todo', 'in_progress', 'blocked'] },
        dueDate: { $lt: now },
      })
      .populate({
        path: 'projectId',
        populate: { path: 'clientId', select: 'name email' },
      });

    for (const task of tasks) {
      if (!task.dueDate) continue;
      const project = task.projectId as unknown as ProjectDocument;
      if (!project || (project as any).status !== 'active') continue;
      const daysOverdue = Math.ceil((now.getTime() - task.dueDate.getTime()) / DAY_MS);
      const dedupeDay = this.dayKey(now);
      await this.engine.dispatch({
        eventKey: 'project.task_overdue',
        contextRef: `task:${task._id}`,
        dedupeKey: `project.task_overdue:${task._id}:${dedupeDay}`,
        projectId: project._id as Types.ObjectId,
        clientId: (project as any).clientId?._id as Types.ObjectId,
        context: {
          task: { title: task.title, dueDate: task.dueDate, priority: task.priority },
          project: { name: (project as any).name },
          client: (project as any).clientId,
          daysOverdue,
        },
      });
    }
  }

  // ===== Planned income overdue =====
  private async runPlannedIncomeOverdue() {
    const now = new Date();
    const items = await this.plannedOccurrenceModel
      .find({
        status: 'planned',
        date: { $lt: now },
      })
      .populate('plannedIncomeId', 'name');

    for (const item of items) {
      const daysOverdue = Math.ceil((now.getTime() - item.date.getTime()) / DAY_MS);
      const dedupeDay = this.dayKey(now);
      await this.engine.dispatch({
        eventKey: 'planned_income.overdue',
        contextRef: `planned_income_occurrence:${item._id}`,
        dedupeKey: `planned_income.overdue:${item._id}:${dedupeDay}`,
        context: {
          plannedIncome: item.plannedIncomeId,
          amount: item.amount,
          currency: item.currency,
          date: item.date,
          daysOverdue,
        },
      });
    }
  }

  // ---------- helpers ----------
  private dayKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private contractCtx(contract: ContractDocument) {
    return {
      title: contract.title,
      amount: contract.amount,
      currency: contract.currency,
      startDate: contract.startDate,
      endDate: contract.endDate,
      billingPeriod: contract.billingPeriod,
    };
  }

  private async findProjectId(contractId: Types.ObjectId): Promise<Types.ObjectId | undefined> {
    const proj = await this.projectModel
      .findOne({ contractId, deletedAt: { $exists: false } })
      .select('_id');
    return proj ? (proj._id as Types.ObjectId) : undefined;
  }
}
