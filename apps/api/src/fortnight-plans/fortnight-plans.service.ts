import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { AnyBulkWriteOperation, Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import {
  Category,
  CategoryDocument,
} from '../categories/schemas/category.schema';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { SettingsService } from '../settings/settings.service';
import {
  Transaction,
  TransactionDocument,
} from '../transactions/schemas/transaction.schema';
import { TransactionsService } from '../transactions/transactions.service';
import {
  ApplyLineDto,
  ClosePlanDto,
  CreateLineDto,
  PromoteLineDto,
  RecordUnplannedDto,
  UpdateLineDto,
  UpdatePlanDto,
} from './dto/fortnight-plan.dto';
import {
  FortnightPeriod,
  isPeriodKey,
  nextPeriod,
  parseDay,
  parsePeriodKey,
  periodForDate,
  previousPeriod,
  shiftIntoPeriod,
  startOfDay,
} from './fortnight-period';
import {
  FortnightSourcesService,
  SourceOccurrence,
} from './fortnight-sources.service';
import {
  computeSummary,
  convert,
  FortnightSummary,
  round2,
  SummaryLine,
  UnlinkedTransaction,
} from './fortnight-summary';
import {
  Currency,
  FortnightPlan,
  FortnightPlanDocument,
  FortnightPlanLine,
  LineStatus,
} from './schemas/fortnight-plan.schema';

type LeanLine = FortnightPlanLine & { _id: Types.ObjectId };
type LeanPlan = Omit<FortnightPlan, 'lines'> & {
  _id: Types.ObjectId;
  lines: LeanLine[];
  createdAt?: Date;
  updatedAt?: Date;
};

type AccountInfo = {
  _id: string;
  name: string;
  currency: Currency;
  isActive: boolean;
  currentBalance: number;
};

/** An apply older than this with no outcome is considered dead and is reconciled. */
const STALE_APPLY_MS = 2 * 60 * 1000;
/** GETs re-sync an open plan with its sources at most this often. */
const AUTO_SYNC_MS = 60 * 1000;

const LIVE_STATUSES: LineStatus[] = ['planned', 'applying', 'applied'];
/** Note sync writes when a source occurrence was omitted in its module. */
const OMITTED_AT_SOURCE = 'Omitted at the source';

function dayString(date?: Date | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function oid(value: string | Types.ObjectId): Types.ObjectId {
  return typeof value === 'string' ? new Types.ObjectId(value) : value;
}

@Injectable()
export class FortnightPlansService {
  private readonly logger = new Logger(FortnightPlansService.name);

  constructor(
    @InjectModel(FortnightPlan.name)
    private readonly planModel: Model<FortnightPlanDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly sources: FortnightSourcesService,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly settingsService: SettingsService,
    private readonly config: ConfigService,
  ) {}

  // ============================================================== reads

  async list(limit = 24) {
    const plans = await this.planModel
      .find(
        {},
        {
          periodKey: 1,
          status: 1,
          startDate: 1,
          endDate: 1,
          closedAt: 1,
          'lines.status': 1,
        },
      )
      .sort({ startDate: -1 })
      .limit(limit)
      .lean();
    return plans.map((plan) => {
      const period = parsePeriodKey(plan.periodKey);
      const lines = (plan.lines ?? []) as Array<{ status: LineStatus }>;
      return {
        _id: plan._id,
        periodKey: plan.periodKey,
        label: period.label,
        status: plan.status,
        startDate: plan.startDate,
        endDate: plan.endDate,
        closedAt: plan.closedAt,
        lineCount: lines.length,
        pendingCount: lines.filter(
          (l) => l.status === 'planned' || l.status === 'applying',
        ).length,
      };
    });
  }

  /** The plan of a fortnight, or `plan: null` when it has not been opened yet. */
  async getDetail(periodKey: string) {
    const period = this.period(periodKey);
    let plan = await this.findPlan(periodKey);
    if (plan && plan.status === 'open') {
      const age = plan.lastSyncedAt
        ? Date.now() - new Date(plan.lastSyncedAt).getTime()
        : Infinity;
      if (age > AUTO_SYNC_MS) {
        await this.syncPlan(plan, false);
        plan = await this.findPlan(periodKey);
      }
    }
    return this.buildDetail(period, plan);
  }

  async analytics(limit = 12) {
    const plans = (await this.planModel
      .find({})
      .sort({ startDate: -1 })
      .limit(limit)
      .lean()) as unknown as LeanPlan[];

    const fxRate = await this.fxRate();
    const categories = await this.categoryNames();
    const rows: Array<{
      periodKey: string;
      label: string;
      status: 'open' | 'closed';
      summary: FortnightSummary;
    }> = [];

    for (const plan of plans) {
      const period = parsePeriodKey(plan.periodKey);
      let summary = plan.closingSummary as unknown as
        | FortnightSummary
        | undefined;
      if (!summary) {
        const unlinked = await this.unlinkedTransactions(
          period,
          plan,
          new Map(),
          categories,
        );
        summary = computeSummary({
          lines: this.summaryLines(plan.lines, categories),
          unlinked,
          balances: null,
          fxRate,
          now: new Date(),
        });
      }
      rows.push({
        periodKey: plan.periodKey,
        label: period.label,
        status: plan.status,
        summary,
      });
    }
    rows.reverse();

    // Category totals across the window, in both currencies.
    const byCategory = new Map<
      string,
      {
        name: string;
        plannedUsd: number;
        actualUsd: number;
        unplannedUsd: number;
        actualNio: number;
      }
    >();
    for (const row of rows) {
      for (const cat of row.summary.byCategory ?? []) {
        const key = cat.categoryId ?? '__none__';
        const entry = byCategory.get(key) ?? {
          name: cat.name,
          plannedUsd: 0,
          actualUsd: 0,
          unplannedUsd: 0,
          actualNio: 0,
        };
        entry.plannedUsd += cat.planned.totalUsd;
        entry.actualUsd += cat.actual.totalUsd;
        entry.unplannedUsd += cat.unplanned.totalUsd;
        entry.actualNio += cat.actual.totalNio;
        byCategory.set(key, entry);
      }
    }

    const scored = rows.filter(
      (r) =>
        r.summary.discipline?.score !== null &&
        r.summary.discipline?.score !== undefined,
    );
    return {
      fxRate,
      periods: rows.map((row) => ({
        periodKey: row.periodKey,
        label: row.label,
        status: row.status,
        incomePlanned: row.summary.income.planned,
        incomeApplied: row.summary.income.applied,
        expensePlanned: row.summary.expense.planned,
        expenseApplied: row.summary.expense.applied,
        savingsApplied: row.summary.savings.applied,
        unplannedExpense: row.summary.unplanned.expense,
        actualSpend: row.summary.actualSpend,
        available: row.summary.available,
        discipline: row.summary.discipline,
      })),
      averageScore:
        scored.length > 0
          ? Math.round(
              scored.reduce(
                (sum, r) => sum + (r.summary.discipline.score ?? 0),
                0,
              ) / scored.length,
            )
          : null,
      categories: Array.from(byCategory.values())
        .map((c) => ({
          ...c,
          plannedUsd: round2(c.plannedUsd),
          actualUsd: round2(c.actualUsd),
          unplannedUsd: round2(c.unplannedUsd),
          actualNio: round2(c.actualNio),
        }))
        .sort((a, b) => b.actualUsd - a.actualUsd)
        .slice(0, 12),
    };
  }

  // ======================================================== plan lifecycle

  /**
   * Opens a fortnight: repeats the manual lines marked to repeat from the
   * last plan, then pulls everything the other modules have scheduled in the
   * window. Idempotent — opening an open fortnight just returns it.
   */
  async open(periodKey: string, userId?: Types.ObjectId) {
    const period = this.period(periodKey);
    let plan = await this.findPlan(periodKey);

    if (!plan) {
      try {
        await this.planModel.create({
          periodKey,
          startDate: period.start,
          endDate: period.end,
          status: 'open',
          lines: [],
          createdBy: userId,
          updatedBy: userId,
        });
      } catch (err) {
        // Two tabs opening the same fortnight: the unique index decides, the loser reads.
        if ((err as { code?: number }).code !== 11000) throw err;
      }
      plan = await this.findPlan(periodKey);
      if (!plan)
        throw new NotFoundException('Fortnight plan could not be created');
      if (plan.lines.length === 0) {
        await this.copyRepeatingLines(plan, period, userId);
      }
    }

    plan = await this.findPlan(periodKey);
    if (plan && plan.status === 'open') {
      await this.syncPlan(plan, true);
    }
    return this.getDetailFresh(period);
  }

  async sync(periodKey: string) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    if (plan.status !== 'open') {
      throw new BadRequestException(
        'This fortnight is closed. Reopen it to sync.',
      );
    }
    await this.syncPlan(plan, true);
    return this.getDetailFresh(period);
  }

  async update(periodKey: string, dto: UpdatePlanDto, userId?: Types.ObjectId) {
    const plan = await this.requirePlan(periodKey);
    await this.planModel.updateOne(
      { _id: plan._id },
      { $set: { notes: dto.notes, updatedBy: userId } },
    );
    return this.getDetailFresh(this.period(periodKey));
  }

  /**
   * Closes the fortnight. Whatever is still planned is carried to the next
   * fortnight (default) or dropped, and the summary is frozen so history no
   * longer moves with later edits or exchange-rate changes.
   */
  async close(periodKey: string, dto: ClosePlanDto, userId?: Types.ObjectId) {
    const period = this.period(periodKey);
    let plan = await this.requirePlan(periodKey);
    if (plan.status === 'closed') {
      return this.getDetailFresh(period);
    }

    await this.syncPlan(plan, false);
    plan = await this.requirePlan(periodKey);

    if (plan.lines.some((line) => line.status === 'applying')) {
      throw new ConflictException(
        'A line is being applied right now. Wait a moment and close again.',
      );
    }

    const pending = plan.lines.filter((line) => line.status === 'planned');
    const mode = dto.pending ?? 'carry';
    for (const line of pending) {
      if (mode === 'carry') {
        await this.carryLineInternal(plan, period, line, userId);
      } else {
        await this.transition(
          plan._id,
          line._id,
          'planned',
          { status: 'skipped' },
          userId,
        );
      }
    }

    plan = await this.requirePlan(periodKey);
    const detail = await this.buildDetail(period, plan);
    await this.planModel.updateOne(
      { _id: plan._id, status: 'open' },
      {
        $set: {
          status: 'closed',
          closedAt: new Date(),
          closedBy: userId,
          closingSummary: detail.summary,
          updatedBy: userId,
        },
      },
    );
    return this.getDetailFresh(period);
  }

  /** Ends the planning wizard: the plan stops being a draft and tracking begins. */
  async confirmPlan(periodKey: string, userId?: Types.ObjectId) {
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    await this.planModel.updateOne(
      { _id: plan._id, status: 'open' },
      { $set: { plannedAt: new Date(), plannedBy: userId, updatedBy: userId } },
    );
    return this.getDetailFresh(this.period(periodKey));
  }

  async reopen(periodKey: string, userId?: Types.ObjectId) {
    const plan = await this.requirePlan(periodKey);
    await this.planModel.updateOne(
      { _id: plan._id },
      {
        $set: { status: 'open', updatedBy: userId },
        $unset: { closedAt: '', closedBy: '', closingSummary: '' },
      },
    );
    const reopened = await this.requirePlan(periodKey);
    await this.syncPlan(reopened, false);
    return this.getDetailFresh(this.period(periodKey));
  }

  /** Discards a plan that has nothing executed in it. Movements are never deleted here. */
  async remove(periodKey: string) {
    const plan = await this.requirePlan(periodKey);
    const result = await this.planModel.deleteOne({
      _id: plan._id,
      'lines.status': { $nin: ['applied', 'applying'] },
    });
    if (result.deletedCount === 0) {
      throw new BadRequestException(
        'This fortnight already has executed lines. Undo them first, or close it instead of deleting it.',
      );
    }
    return { deleted: true, periodKey };
  }

  // ================================================================ lines

  async addLine(
    periodKey: string,
    dto: CreateLineDto,
    userId?: Types.ObjectId,
  ) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    await this.assertReferences(dto);

    const line = {
      _id: new Types.ObjectId(),
      kind: dto.kind,
      source: 'manual' as const,
      name: dto.name.trim(),
      plannedAmount: round2(dto.plannedAmount),
      currency: dto.currency,
      categoryId: dto.categoryId ? oid(dto.categoryId) : undefined,
      accountId: dto.accountId ? oid(dto.accountId) : undefined,
      toAccountId:
        dto.kind === 'savings' && dto.toAccountId
          ? oid(dto.toAccountId)
          : undefined,
      dueDate: dto.dueDate ? parseDay(dto.dueDate) : undefined,
      status: 'planned' as const,
      note: dto.note,
      repeat: dto.repeat ?? false,
      unplanned: false,
      amountOverridden: false,
      order: this.nextOrder(plan),
      createdBy: userId,
      updatedBy: userId,
    };
    this.assertDueInWindow(line.dueDate, period);

    await this.planModel.updateOne(
      { _id: plan._id },
      { $push: { lines: line }, $set: { updatedBy: userId } },
    );
    return this.getDetailFresh(period);
  }

  async updateLine(
    periodKey: string,
    lineId: string,
    dto: UpdateLineDto,
    userId?: Types.ObjectId,
  ) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);

    if (line.status !== 'planned' && line.status !== 'skipped') {
      throw new BadRequestException(
        `An ${line.status} line cannot be edited. Undo it first.`,
      );
    }

    const set: Record<string, unknown> = { 'lines.$.updatedBy': userId };
    const unset: Record<string, ''> = {};

    if (line.source !== 'manual') {
      // The schedule belongs to its module; only what is planned for this fortnight is ours.
      const forbidden = (
        [
          'kind',
          'name',
          'currency',
          'categoryId',
          'accountId',
          'toAccountId',
          'dueDate',
        ] as const
      ).filter((key) => dto[key] !== undefined);
      if (forbidden.length > 0) {
        throw new BadRequestException(
          `This line comes from ${this.sourceLabel(line.source)}. Change ${forbidden.join(', ')} there; here you can only adjust the planned amount and the note.`,
        );
      }
    } else {
      await this.assertReferences({ ...dto, kind: dto.kind ?? line.kind });
      const kind = dto.kind ?? line.kind;
      if (dto.kind !== undefined) set['lines.$.kind'] = dto.kind;
      if (dto.name !== undefined) set['lines.$.name'] = dto.name.trim();
      if (dto.currency !== undefined) set['lines.$.currency'] = dto.currency;
      if (dto.categoryId !== undefined)
        set['lines.$.categoryId'] = oid(dto.categoryId);
      if (dto.accountId !== undefined)
        set['lines.$.accountId'] = oid(dto.accountId);
      if (dto.repeat !== undefined) set['lines.$.repeat'] = dto.repeat;
      if (dto.dueDate !== undefined) {
        const due = parseDay(dto.dueDate);
        this.assertDueInWindow(due, period);
        set['lines.$.dueDate'] = due;
      }
      // Only savings move money to a second account.
      if (kind === 'savings') {
        if (dto.toAccountId !== undefined)
          set['lines.$.toAccountId'] = oid(dto.toAccountId);
      } else if (line.toAccountId) {
        unset['lines.$.toAccountId'] = '';
      }
    }

    if (dto.plannedAmount !== undefined) {
      set['lines.$.plannedAmount'] = round2(dto.plannedAmount);
      if (line.source !== 'manual') set['lines.$.amountOverridden'] = true;
    }
    if (dto.note !== undefined) set['lines.$.note'] = dto.note;

    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length > 0) update.$unset = unset;

    const result = await this.planModel.updateOne(
      {
        _id: plan._id,
        lines: { $elemMatch: { _id: line._id, status: line.status } },
      },
      update,
    );
    if (result.matchedCount === 0) {
      throw new ConflictException(
        'This line changed in the meantime. Refresh and try again.',
      );
    }
    return this.getDetailFresh(period);
  }

  async removeLine(periodKey: string, lineId: string) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);

    if (line.source !== 'manual') {
      throw new BadRequestException(
        `This line comes from ${this.sourceLabel(line.source)}. Skip it for this fortnight, or omit it at the source.`,
      );
    }
    const result = await this.planModel.updateOne(
      { _id: plan._id },
      {
        $pull: {
          lines: { _id: line._id, status: { $in: ['planned', 'skipped'] } },
        },
      },
    );
    if (result.modifiedCount === 0) {
      throw new BadRequestException(
        'Only planned or skipped lines can be removed. Undo an applied line first.',
      );
    }
    return this.getDetailFresh(period);
  }

  /**
   * Executes a line: records the movement in the books exactly once.
   *
   * The line is claimed (planned → applying) atomically before any money
   * moves, so a double click or a second tab gets a 409 instead of a second
   * payment. If the movement fails the claim is released; if the process dies
   * mid-way, sync reconciles the line from what was really recorded.
   */
  async applyLine(
    periodKey: string,
    lineId: string,
    dto: ApplyLineDto,
    userId?: Types.ObjectId,
  ) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);

    if (line.status !== 'planned') {
      throw new ConflictException(
        `This line is already ${line.status}. Only planned lines can be applied.`,
      );
    }

    const amount = round2(dto.amount ?? line.plannedAmount);
    if (!(amount > 0)) {
      throw new BadRequestException('Enter the amount that was actually paid.');
    }
    const date = dto.date ? parseDay(dto.date) : startOfDay(new Date());
    const note = dto.note?.trim() || line.note;

    // Resolve and validate everything before claiming, so a bad input never leaves a claim behind.
    const execute = await this.prepareExecution(
      line,
      { ...dto, amount, date, note },
      userId,
    );

    await this.claim(plan._id, line._id, 'planned', userId);

    let outcome: Awaited<ReturnType<typeof execute.run>>;
    try {
      outcome = await execute.run();
    } catch (err) {
      await this.release(plan._id, line._id, 'planned');
      throw err;
    }

    const set: Record<string, unknown> = {
      'lines.$.status': 'applied',
      'lines.$.appliedAmount': amount,
      'lines.$.appliedAccountAmount': outcome.accountAmount,
      'lines.$.appliedAccountCurrency': outcome.accountCurrency,
      'lines.$.appliedExchangeRate': outcome.exchangeRate,
      'lines.$.appliedDate': date,
      'lines.$.appliedAt': new Date(),
      'lines.$.transactionId': outcome.transactionId,
      'lines.$.note': note,
      'lines.$.updatedBy': userId,
    };
    if (line.source === 'manual') {
      if (execute.accountId) set['lines.$.accountId'] = execute.accountId;
      if (execute.categoryId) set['lines.$.categoryId'] = execute.categoryId;
      if (execute.toAccountId) set['lines.$.toAccountId'] = execute.toAccountId;
    }
    await this.planModel.updateOne(
      {
        _id: plan._id,
        lines: { $elemMatch: { _id: line._id, status: 'applying' } },
      },
      { $set: set, $unset: { 'lines.$.applyStartedAt': '' } },
    );

    if (
      dto.keepRemainder &&
      line.source === 'manual' &&
      amount < line.plannedAmount
    ) {
      const remainder = round2(line.plannedAmount - amount);
      await this.planModel.updateOne(
        { _id: plan._id },
        {
          $push: {
            lines: {
              _id: new Types.ObjectId(),
              kind: line.kind,
              source: 'manual',
              name: `${line.name} (remainder)`,
              plannedAmount: remainder,
              currency: line.currency,
              categoryId: execute.categoryId ?? line.categoryId,
              accountId: execute.accountId ?? line.accountId,
              toAccountId: execute.toAccountId ?? line.toAccountId,
              dueDate: line.dueDate,
              status: 'planned',
              note: `Left after paying ${amount} of ${line.plannedAmount}`,
              repeat: false,
              unplanned: false,
              amountOverridden: false,
              order: line.order + 0.5,
              createdBy: userId,
              updatedBy: userId,
            },
          },
        },
      );
    }

    return this.getDetailFresh(period);
  }

  /**
   * Reverses a manual line: voids the movement and puts the line back to
   * planned. Lines from loans and other modules cannot be undone here,
   * because reversing them means undoing amortisation in their own module.
   */
  async unapplyLine(
    periodKey: string,
    lineId: string,
    userId?: Types.ObjectId,
  ) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);

    if (line.status !== 'applied') {
      throw new BadRequestException('Only applied lines can be undone.');
    }
    if (line.source === 'loan') {
      // The loans module owns the balance: it rolls it back and voids the movement.
      if (!line.sourceOccurrenceId) {
        throw new BadRequestException('This loan line has no payment to undo.');
      }
      await this.claim(plan._id, line._id, 'applied', userId);
      try {
        await this.sources.unconfirm(
          line.source,
          line.sourceOccurrenceId,
          userId,
        );
      } catch (err) {
        await this.release(plan._id, line._id, 'applied');
        throw err;
      }
      await this.planModel.updateOne(
        {
          _id: plan._id,
          lines: { $elemMatch: { _id: line._id, status: 'applying' } },
        },
        {
          $set: { 'lines.$.status': 'planned', 'lines.$.updatedBy': userId },
          $unset: this.appliedFieldsUnset(),
        },
      );
      return this.getDetailFresh(period);
    }
    if (line.source !== 'manual') {
      throw new BadRequestException(
        `This payment was recorded through ${this.sourceLabel(line.source)}. Undo it there.`,
      );
    }

    await this.claim(plan._id, line._id, 'applied', userId);
    try {
      if (line.transactionId) {
        const tx = await this.transactionModel
          .findById(line.transactionId)
          .lean();
        if (tx && !tx.voidedAt) {
          await this.transactionsService.void(
            line.transactionId.toString(),
            userId,
          );
        }
      }
    } catch (err) {
      await this.release(plan._id, line._id, 'applied');
      throw err;
    }

    if (line.unplanned) {
      // It only ever existed as a record of what was spent.
      await this.planModel.updateOne(
        { _id: plan._id },
        { $pull: { lines: { _id: line._id, status: 'applying' } } },
      );
    } else {
      await this.planModel.updateOne(
        {
          _id: plan._id,
          lines: { $elemMatch: { _id: line._id, status: 'applying' } },
        },
        {
          $set: { 'lines.$.status': 'planned', 'lines.$.updatedBy': userId },
          $unset: this.appliedFieldsUnset(),
        },
      );
    }
    return this.getDetailFresh(period);
  }

  /** Not this fortnight. The occurrence stays open in its module; nothing is recorded. */
  async skipLine(periodKey: string, lineId: string, userId?: Types.ObjectId) {
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);
    await this.transition(
      plan._id,
      line._id,
      'planned',
      { status: 'skipped' },
      userId,
    );
    return this.getDetailFresh(this.period(periodKey));
  }

  async restoreLine(
    periodKey: string,
    lineId: string,
    userId?: Types.ObjectId,
  ) {
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);
    if (line.status !== 'skipped') {
      throw new BadRequestException(
        'Only lines left out can be included again.',
      );
    }
    // Left out because it was omitted in its module: including it again means
    // putting it back there too, otherwise it could never be applied and the
    // next sync would leave it out again.
    if (line.source !== 'manual' && line.sourceOccurrenceId) {
      await this.sources.reactivateIfOmitted(
        line.source,
        line.sourceOccurrenceId,
        userId,
      );
    }
    await this.transition(
      plan._id,
      line._id,
      'skipped',
      { status: 'planned' },
      userId,
    );
    if (line.note === OMITTED_AT_SOURCE) {
      await this.planModel.updateOne(
        {
          _id: plan._id,
          lines: { $elemMatch: { _id: line._id, note: OMITTED_AT_SOURCE } },
        },
        { $unset: { 'lines.$.note': '' } },
      );
    }
    return this.getDetailFresh(this.period(periodKey));
  }

  /**
   * Cancels the occurrence in its own module (it will never be paid). For an
   * interest-bearing loan this capitalises the period's interest — the loan
   * module applies that rule, not the planner.
   */
  async omitLine(periodKey: string, lineId: string, userId?: Types.ObjectId) {
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);
    if (line.source === 'manual' || !line.sourceOccurrenceId) {
      throw new BadRequestException(
        'Manual lines have nothing to omit at the source. Skip or remove them instead.',
      );
    }
    if (line.status !== 'planned' && line.status !== 'skipped') {
      throw new BadRequestException(
        'Only planned or skipped lines can be omitted.',
      );
    }
    await this.sources.omit(line.source, line.sourceOccurrenceId, userId);
    await this.planModel.updateOne(
      {
        _id: plan._id,
        lines: { $elemMatch: { _id: line._id, status: line.status } },
      },
      {
        $set: {
          'lines.$.status': 'skipped',
          'lines.$.note': line.note || OMITTED_AT_SOURCE,
          'lines.$.updatedBy': userId,
        },
      },
    );
    return this.getDetailFresh(this.period(periodKey));
  }

  /** Moves a planned line into the next fortnight. */
  async carryLine(periodKey: string, lineId: string, userId?: Types.ObjectId) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);
    if (line.status !== 'planned') {
      throw new BadRequestException(
        'Only planned lines can be moved to the next fortnight.',
      );
    }
    await this.carryLineInternal(plan, period, line, userId);
    return this.getDetailFresh(period);
  }

  /** Records spending (or income) that was never planned, straight into the books. */
  async recordUnplanned(
    periodKey: string,
    dto: RecordUnplannedDto,
    userId?: Types.ObjectId,
  ) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);

    const kind = dto.kind ?? 'expense';
    const date = dto.date ? parseDay(dto.date) : startOfDay(new Date());
    if (date < period.start || date > period.end) {
      throw new BadRequestException(
        `The date must fall inside ${period.label}.`,
      );
    }
    const lineId = new Types.ObjectId();
    const line = {
      _id: lineId,
      kind,
      source: 'manual' as const,
      name: dto.name.trim(),
      plannedAmount: round2(dto.amount),
      currency: dto.currency,
      categoryId: oid(dto.categoryId),
      accountId: oid(dto.accountId),
      dueDate: date,
      status: 'applying' as const,
      applyStartedAt: new Date(),
      note: dto.note,
      repeat: false,
      unplanned: true,
      amountOverridden: false,
      order: this.nextOrder(plan),
      createdBy: userId,
      updatedBy: userId,
    };

    const execute = await this.prepareExecution(
      line,
      {
        amount: line.plannedAmount,
        date,
        note: dto.note,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
      },
      userId,
    );

    await this.planModel.updateOne(
      { _id: plan._id },
      { $push: { lines: line } },
    );
    let outcome: Awaited<ReturnType<typeof execute.run>>;
    try {
      outcome = await execute.run();
    } catch (err) {
      await this.planModel.updateOne(
        { _id: plan._id },
        { $pull: { lines: { _id: lineId } } },
      );
      throw err;
    }

    await this.planModel.updateOne(
      {
        _id: plan._id,
        lines: { $elemMatch: { _id: lineId, status: 'applying' } },
      },
      {
        $set: {
          'lines.$.status': 'applied',
          'lines.$.appliedAmount': line.plannedAmount,
          'lines.$.appliedAccountAmount': outcome.accountAmount,
          'lines.$.appliedAccountCurrency': outcome.accountCurrency,
          'lines.$.appliedExchangeRate': outcome.exchangeRate,
          'lines.$.appliedDate': date,
          'lines.$.appliedAt': new Date(),
          'lines.$.transactionId': outcome.transactionId,
        },
        $unset: { 'lines.$.applyStartedAt': '' },
      },
    );
    return this.getDetailFresh(period);
  }

  /**
   * Turns a manual line that keeps coming back into a real recurring expense,
   * so future fortnights pull it from the schedule instead of copying it.
   */
  async promoteLine(
    periodKey: string,
    lineId: string,
    dto: PromoteLineDto,
    userId?: Types.ObjectId,
  ) {
    const period = this.period(periodKey);
    const plan = await this.requirePlan(periodKey);
    this.assertOpen(plan);
    const line = this.requireLine(plan, lineId);

    if (line.source !== 'manual' || line.unplanned || line.kind !== 'expense') {
      throw new BadRequestException(
        'Only planned manual expenses can become recurring expenses.',
      );
    }
    if (line.status !== 'planned' && line.status !== 'applied') {
      throw new BadRequestException(
        'Only planned or applied lines can become recurring expenses.',
      );
    }
    if (!line.accountId || !line.categoryId) {
      throw new BadRequestException(
        'Set the account and the category on the line first.',
      );
    }
    const account = await this.accountsService.findById(
      line.accountId.toString(),
    );
    if (account.currency !== line.currency) {
      throw new BadRequestException(
        `Recurring expenses are charged in their account's currency. Pick a ${line.currency} account for this line first.`,
      );
    }

    const recurring = await this.recurringExpensesService.create(
      {
        name: line.name,
        amount: line.plannedAmount,
        currency: line.currency,
        accountId: line.accountId.toString(),
        categoryId: line.categoryId.toString(),
        daysOfMonth: dto.daysOfMonth,
        isActive: true,
        notes: line.note,
      },
      userId,
    );

    const inWindow = await this.sources.recurringOccurrencesIn(
      recurring._id,
      period,
    );
    const due = line.dueDate
      ? new Date(line.dueDate).getTime()
      : period.start.getTime();
    const closest = [...inWindow].sort(
      (a, b) =>
        Math.abs(new Date(a.date).getTime() - due) -
        Math.abs(new Date(b.date).getTime() - due),
    )[0];

    const set: Record<string, unknown> = {
      'lines.$.repeat': false,
      'lines.$.promotedToRecurringId': recurring._id,
      'lines.$.updatedBy': userId,
    };

    if (closest && line.status === 'planned') {
      // The line becomes that occurrence: applying it later confirms the schedule.
      Object.assign(set, {
        'lines.$.source': 'recurring_expense',
        'lines.$.sourceId': recurring._id,
        'lines.$.sourceOccurrenceId': closest._id,
        'lines.$.dueDate': closest.date,
      });
    } else if (closest && line.status === 'applied') {
      // Already paid this fortnight by hand: the schedule's occurrence must not ask for it again.
      await this.sources.omit('recurring_expense', closest._id, userId);
      set['lines.$.sourceOccurrenceId'] = closest._id;
    }

    await this.planModel.updateOne(
      {
        _id: plan._id,
        lines: { $elemMatch: { _id: line._id, status: line.status } },
      },
      { $set: set },
    );
    const refreshed = await this.requirePlan(periodKey);
    await this.syncPlan(refreshed, false);
    return this.getDetailFresh(period);
  }

  // ============================================================== internals

  private period(periodKey: string): FortnightPeriod {
    if (!isPeriodKey(periodKey)) {
      throw new BadRequestException(
        'Fortnight keys look like 2026-11-1 (1st–15th) or 2026-11-2 (16th–end).',
      );
    }
    return parsePeriodKey(periodKey);
  }

  private async findPlan(periodKey: string): Promise<LeanPlan | null> {
    return await this.planModel.findOne({ periodKey }).lean();
  }

  private async requirePlan(periodKey: string): Promise<LeanPlan> {
    this.period(periodKey);
    const plan = await this.findPlan(periodKey);
    if (!plan) {
      throw new NotFoundException('This fortnight has not been planned yet.');
    }
    return plan;
  }

  private requireLine(plan: LeanPlan, lineId: string): LeanLine {
    if (!Types.ObjectId.isValid(lineId)) {
      throw new BadRequestException('Invalid line id');
    }
    const line = plan.lines.find((item) => item._id.toString() === lineId);
    if (!line) {
      throw new NotFoundException('Line not found in this fortnight');
    }
    return line;
  }

  private assertOpen(plan: LeanPlan) {
    if (plan.status !== 'open') {
      throw new BadRequestException(
        'This fortnight is closed. Reopen it to make changes.',
      );
    }
  }

  private assertDueInWindow(due: Date | undefined, period: FortnightPeriod) {
    if (due && (due < period.start || due > period.end)) {
      throw new BadRequestException(
        `The due date must fall inside ${period.label}.`,
      );
    }
  }

  private async assertReferences(dto: {
    kind?: string;
    categoryId?: string;
    accountId?: string;
    toAccountId?: string;
  }) {
    if (dto.accountId) await this.accountsService.findById(dto.accountId);
    if (dto.toAccountId) {
      await this.accountsService.findById(dto.toAccountId);
      if (dto.toAccountId === dto.accountId) {
        throw new BadRequestException(
          'Savings must go to a different account than the one it comes from.',
        );
      }
    }
    if (dto.categoryId) {
      const exists = await this.categoryModel.exists({ _id: dto.categoryId });
      if (!exists) throw new NotFoundException('Category not found');
    }
  }

  private nextOrder(plan: LeanPlan) {
    return (
      plan.lines.reduce((max, line) => Math.max(max, line.order ?? 0), 0) + 1
    );
  }

  private sourceLabel(source: string) {
    switch (source) {
      case 'loan':
        return 'Loans';
      case 'recurring_expense':
        return 'Recurring expenses';
      case 'subscription':
        return 'Subscriptions';
      case 'planned_income':
        return 'Planned income';
      default:
        return 'the planner';
    }
  }

  private appliedFieldsUnset(): Record<string, ''> {
    return {
      'lines.$.applyStartedAt': '',
      'lines.$.appliedAmount': '',
      'lines.$.appliedAccountAmount': '',
      'lines.$.appliedAccountCurrency': '',
      'lines.$.appliedExchangeRate': '',
      'lines.$.appliedDate': '',
      'lines.$.appliedAt': '',
      'lines.$.transactionId': '',
    };
  }

  /** Atomic status claim. Throws 409 when someone else got there first. */
  private async claim(
    planId: Types.ObjectId,
    lineId: Types.ObjectId,
    from: LineStatus,
    userId?: Types.ObjectId,
  ) {
    const claimed = await this.planModel.findOneAndUpdate(
      {
        _id: planId,
        status: 'open',
        lines: { $elemMatch: { _id: lineId, status: from } },
      },
      {
        $set: {
          'lines.$.status': 'applying',
          'lines.$.applyStartedAt': new Date(),
          updatedBy: userId,
        },
      },
      { new: true, projection: { _id: 1 } },
    );
    if (!claimed) {
      throw new ConflictException(
        'This line was just changed (maybe in another tab). Refresh and try again.',
      );
    }
  }

  private async release(
    planId: Types.ObjectId,
    lineId: Types.ObjectId,
    back: LineStatus,
  ) {
    await this.planModel.updateOne(
      {
        _id: planId,
        lines: { $elemMatch: { _id: lineId, status: 'applying' } },
      },
      {
        $set: { 'lines.$.status': back },
        $unset: { 'lines.$.applyStartedAt': '' },
      },
    );
  }

  private async transition(
    planId: Types.ObjectId,
    lineId: Types.ObjectId,
    from: LineStatus,
    set: Record<string, unknown>,
    userId?: Types.ObjectId,
  ) {
    const prefixed: Record<string, unknown> = { 'lines.$.updatedBy': userId };
    for (const [key, value] of Object.entries(set))
      prefixed[`lines.$.${key}`] = value;
    const result = await this.planModel.updateOne(
      {
        _id: planId,
        status: 'open',
        lines: { $elemMatch: { _id: lineId, status: from } },
      },
      { $set: prefixed },
    );
    if (result.matchedCount === 0) {
      throw new ConflictException(
        `Only ${from} lines can do that. Refresh and try again.`,
      );
    }
  }

  /**
   * Resolves accounts, categories and FX for a line and returns the closure
   * that moves the money. Nothing is written until `run()` is called.
   */
  private async prepareExecution(
    line: LeanLine,
    input: {
      amount: number;
      date: Date;
      note?: string;
      accountId?: string;
      categoryId?: string;
      toAccountId?: string;
    },
    userId?: Types.ObjectId,
  ) {
    const dateIso = input.date.toISOString();

    if (line.source !== 'manual') {
      if (!line.sourceOccurrenceId) {
        throw new BadRequestException(
          'This line lost its link to the schedule. Sync the fortnight.',
        );
      }
      if (
        input.accountId &&
        line.accountId &&
        input.accountId !== line.accountId.toString()
      ) {
        throw new BadRequestException(
          `The paying account is set on the ${this.sourceLabel(line.source)} entry. Change it there.`,
        );
      }
      const source = line.source;
      const occurrenceId = line.sourceOccurrenceId;
      return {
        accountId: undefined as Types.ObjectId | undefined,
        categoryId: undefined as Types.ObjectId | undefined,
        toAccountId: undefined as Types.ObjectId | undefined,
        run: async () =>
          this.sources.confirm(
            source,
            occurrenceId,
            { amount: input.amount, date: input.date, note: input.note },
            userId,
          ),
      };
    }

    const accountId = input.accountId ?? line.accountId?.toString();
    if (!accountId) {
      throw new BadRequestException(
        line.kind === 'income'
          ? 'Choose the account the money arrived in.'
          : 'Choose the account the money came from.',
      );
    }
    const account = await this.accountsService.findById(accountId);
    const fx = await this.fxRate();
    const reference = line.unplanned
      ? `Unplanned: ${line.name}`
      : `Bi-weekly plan: ${line.name}`;

    if (line.kind === 'savings') {
      const toAccountId = input.toAccountId ?? line.toAccountId?.toString();
      if (!toAccountId) {
        throw new BadRequestException('Choose the account the savings go to.');
      }
      if (toAccountId === accountId) {
        throw new BadRequestException(
          'Savings must go to a different account than the one it comes from.',
        );
      }
      const toAccount = await this.accountsService.findById(toAccountId);
      const fromAmount = convert(
        input.amount,
        line.currency,
        account.currency,
        fx,
      );
      if (!(fromAmount >= 0.01)) {
        throw new BadRequestException('The amount is too small to record.');
      }
      return {
        accountId: oid(accountId),
        categoryId: undefined as Types.ObjectId | undefined,
        toAccountId: oid(toAccountId),
        run: async () => {
          const result = await this.transactionsService.createTransfer(
            {
              fromAccountId: accountId,
              toAccountId,
              amount: fromAmount,
              currency: account.currency,
              exchangeRate:
                account.currency !== toAccount.currency ? fx : undefined,
              date: dateIso,
              reference,
              notes: input.note,
            },
            userId,
            { planLineId: line._id },
          );
          return {
            transactionId: result.out._id,
            accountAmount: fromAmount,
            accountCurrency: account.currency,
            exchangeRate: account.currency !== line.currency ? fx : undefined,
          };
        },
      };
    }

    const categoryId = input.categoryId ?? line.categoryId?.toString();
    if (!categoryId) {
      throw new BadRequestException(
        'Choose a category, so this shows up in the analysis.',
      );
    }
    const accountAmount = convert(
      input.amount,
      line.currency,
      account.currency,
      fx,
    );
    if (!(accountAmount >= 0.01)) {
      throw new BadRequestException('The amount is too small to record.');
    }
    const converted = account.currency !== line.currency;

    return {
      accountId: oid(accountId),
      categoryId: oid(categoryId),
      toAccountId: undefined as Types.ObjectId | undefined,
      run: async () => {
        const tx = await this.transactionsService.create(
          {
            type: line.kind === 'income' ? 'income' : 'expense',
            accountId,
            categoryId,
            amount: accountAmount,
            currency: account.currency,
            exchangeRate: converted ? fx : undefined,
            date: dateIso,
            reference,
            notes: converted
              ? [
                  `${line.currency} ${input.amount.toFixed(2)} at ${fx} C$/USD`,
                  input.note,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : input.note,
          },
          userId,
          { planLineId: line._id },
        );
        return {
          transactionId: tx._id,
          accountAmount,
          accountCurrency: account.currency,
          exchangeRate: converted ? fx : undefined,
        };
      },
    };
  }

  private async carryLineInternal(
    plan: LeanPlan,
    period: FortnightPeriod,
    line: LeanLine,
    userId?: Types.ObjectId,
  ) {
    const next = nextPeriod(period);
    await this.transition(
      plan._id,
      line._id,
      'planned',
      { status: 'carried', carriedToPeriod: next.key },
      userId,
    );

    try {
      let target = await this.findPlan(next.key);
      if (!target) {
        await this.open(next.key, userId);
        target = await this.findPlan(next.key);
      }
      if (!target)
        throw new NotFoundException('Next fortnight could not be opened');

      const copy = {
        _id: new Types.ObjectId(),
        kind: line.kind,
        source: line.source,
        sourceId: line.sourceId,
        sourceOccurrenceId: line.sourceOccurrenceId,
        name: line.name,
        categoryId: line.categoryId,
        accountId: line.accountId,
        toAccountId: line.toAccountId,
        plannedAmount: line.plannedAmount,
        currency: line.currency,
        amountOverridden: line.amountOverridden,
        // Keeps its original due date: in the next fortnight it is overdue, and it shows.
        dueDate: line.dueDate,
        status: 'planned' as const,
        note: line.note,
        repeat: false,
        unplanned: false,
        carriedFromPeriod: period.key,
        meta: line.meta,
        order: this.nextOrder(target),
        createdBy: userId,
        updatedBy: userId,
      };

      // A source occurrence can only live once per plan; opening the next
      // fortnight may already have pulled it in as overdue.
      const filter: Record<string, unknown> = { _id: target._id };
      if (line.sourceOccurrenceId) {
        filter['lines.sourceOccurrenceId'] = { $ne: line.sourceOccurrenceId };
      }
      const pushed = await this.planModel.updateOne(filter, {
        $push: { lines: copy },
      });
      if (pushed.modifiedCount === 0 && line.sourceOccurrenceId) {
        // Already there: keep the user's planned amount and say where it came from.
        await this.planModel.updateOne(
          {
            _id: target._id,
            lines: {
              $elemMatch: {
                sourceOccurrenceId: line.sourceOccurrenceId,
                status: 'planned',
              },
            },
          },
          {
            $set: {
              'lines.$.carriedFromPeriod': period.key,
              'lines.$.plannedAmount': line.plannedAmount,
              'lines.$.amountOverridden': line.amountOverridden,
              'lines.$.note': line.note,
            },
          },
        );
      }
    } catch (err) {
      await this.planModel.updateOne(
        {
          _id: plan._id,
          lines: { $elemMatch: { _id: line._id, status: 'carried' } },
        },
        {
          $set: { 'lines.$.status': 'planned' },
          $unset: { 'lines.$.carriedToPeriod': '' },
        },
      );
      throw err;
    }
  }

  private async copyRepeatingLines(
    plan: LeanPlan,
    period: FortnightPeriod,
    userId?: Types.ObjectId,
  ) {
    const previous = (await this.planModel
      .findOne({ startDate: { $lt: period.start } })
      .sort({ startDate: -1 })
      .lean()) as unknown as LeanPlan | null;
    if (!previous) return;

    const from = parsePeriodKey(previous.periodKey);
    const repeating = previous.lines.filter(
      (line) =>
        line.source === 'manual' &&
        line.repeat &&
        !line.unplanned &&
        !line.carriedFromPeriod,
    );
    if (repeating.length === 0) return;

    const copies = repeating.map((line, index) => ({
      _id: new Types.ObjectId(),
      kind: line.kind,
      source: 'manual' as const,
      name: line.name.replace(/ \(remainder\)$/, ''),
      categoryId: line.categoryId,
      accountId: line.accountId,
      toAccountId: line.toAccountId,
      plannedAmount: line.plannedAmount,
      currency: line.currency,
      dueDate: shiftIntoPeriod(line.dueDate, from, period),
      status: 'planned' as const,
      note: line.note,
      repeat: true,
      unplanned: false,
      amountOverridden: false,
      order: index + 1,
      createdBy: userId,
      updatedBy: userId,
    }));
    await this.planModel.updateOne(
      { _id: plan._id, 'lines.0': { $exists: false } },
      { $push: { lines: { $each: copies } } },
    );
  }

  /**
   * Brings the plan in line with its sources:
   *  - new occurrences in the window become lines; lines due outside it
   *    that were not carried here (and hold no money) go away;
   *  - lines whose occurrence was confirmed / omitted elsewhere follow it;
   *  - lines whose occurrence vanished (a rebuilt loan schedule) go away;
   *  - applies that died half-way are resolved from what was really recorded.
   *
   * Every write is a conditional, per-line update, so a sync can never
   * clobber an apply running at the same time.
   */
  private async syncPlan(plan: LeanPlan, generate: boolean) {
    if (plan.status !== 'open') return;
    const period = parsePeriodKey(plan.periodKey);
    const now = Date.now();

    if (generate) {
      try {
        await this.sources.generate(period);
      } catch (err) {
        this.logger.warn(
          `Occurrence generation failed for ${plan.periodKey}: ${(err as Error).message}`,
        );
      }
    }

    const knownIds = plan.lines
      .map((line) => line.sourceOccurrenceId)
      .filter((id): id is Types.ObjectId => !!id);
    const occurrences = await this.sources.fetch(period, knownIds);
    const byId = new Map(
      occurrences.map((occ) => [occ.occurrenceId.toString(), occ]),
    );
    const ownedElsewhere = await this.ownedByOtherPlans(
      plan._id,
      occurrences.map((occ) => occ.occurrenceId),
    );

    const ops: AnyBulkWriteOperation<FortnightPlanDocument>[] = [];
    const setLine = (
      line: LeanLine,
      expected: LineStatus,
      set: Record<string, unknown>,
      unset?: Record<string, ''>,
    ) => {
      const update: Record<string, unknown> = { $set: set };
      if (unset && Object.keys(unset).length > 0) update.$unset = unset;
      ops.push({
        updateOne: {
          filter: {
            _id: plan._id,
            lines: { $elemMatch: { _id: line._id, status: expected } },
          },
          update,
        },
      });
    };
    const pullLine = (line: LeanLine, expected: LineStatus) => {
      ops.push({
        updateOne: {
          filter: { _id: plan._id },
          update: { $pull: { lines: { _id: line._id, status: expected } } },
        },
      });
    };

    for (const line of plan.lines) {
      const stale =
        line.status === 'applying' &&
        (!line.applyStartedAt ||
          now - new Date(line.applyStartedAt).getTime() > STALE_APPLY_MS);
      if (line.status === 'applying' && !stale) continue;

      if (line.source === 'manual') {
        if (stale) await this.recoverManual(line, setLine, pullLine);
        continue;
      }
      if (!line.sourceOccurrenceId) continue;

      const key = line.sourceOccurrenceId.toString();
      const occ = byId.get(key);

      if (!occ) {
        // The schedule no longer has it (loan rebuilt, template removed).
        if (line.status === 'planned' || line.status === 'skipped' || stale)
          pullLine(line, line.status);
        continue;
      }
      if (
        (line.status === 'planned' || line.status === 'skipped') &&
        !line.carriedFromPeriod &&
        !(occ.date >= period.start && occ.date <= period.end)
      ) {
        // Due outside this fortnight and not carried here on purpose: it
        // belongs to another fortnight (or was pulled in by the old
        // "unconfirmed = overdue" rule). Applied lines stay — they hold money.
        pullLine(line, line.status);
        continue;
      }
      if (ownedElsewhere.has(key) && line.status !== 'applied') {
        // Another fortnight is handling this payment now.
        continue;
      }

      if (occ.status === 'confirmed') {
        if (line.status === 'planned' || line.status === 'skipped' || stale) {
          setLine(line, line.status, this.appliedFromOccurrence(occ), {
            'lines.$.applyStartedAt': '',
          });
        }
      } else if (occ.status === 'omitted') {
        if (line.status === 'planned' || stale) {
          setLine(
            line,
            line.status,
            {
              'lines.$.status': 'skipped',
              'lines.$.note': line.note || OMITTED_AT_SOURCE,
            },
            { 'lines.$.applyStartedAt': '' },
          );
        }
      } else if (stale) {
        setLine(
          line,
          'applying',
          { 'lines.$.status': 'planned' },
          { 'lines.$.applyStartedAt': '' },
        );
      } else if (line.status === 'planned') {
        const set: Record<string, unknown> = {};
        if (
          !line.amountOverridden &&
          round2(line.plannedAmount) !== round2(occ.amount)
        ) {
          set['lines.$.plannedAmount'] = round2(occ.amount);
        }
        if (
          dayString(line.dueDate) !== dayString(occ.date) &&
          !line.carriedFromPeriod
        ) {
          set['lines.$.dueDate'] = occ.date;
        }
        if (
          occ.meta &&
          JSON.stringify(occ.meta) !== JSON.stringify(line.meta ?? {})
        ) {
          set['lines.$.meta'] = occ.meta;
        }
        if (occ.templateInactive) {
          pullLine(line, 'planned');
        } else if (Object.keys(set).length > 0) {
          setLine(line, 'planned', set);
        }
      }
    }

    const inPlan = new Set(knownIds.map((id) => id.toString()));
    let order = this.nextOrder(plan);
    for (const occ of occurrences) {
      const key = occ.occurrenceId.toString();
      if (inPlan.has(key) || ownedElsewhere.has(key)) continue;
      const inWindow = occ.date >= period.start && occ.date <= period.end;
      if (!inWindow) continue;
      if (occ.status === 'planned' && occ.templateInactive) continue;

      ops.push({
        updateOne: {
          filter: {
            _id: plan._id,
            status: 'open',
            'lines.sourceOccurrenceId': { $ne: occ.occurrenceId },
          },
          update: { $push: { lines: this.lineFromOccurrence(occ, order) } },
        },
      });
      order += 1;
    }

    ops.push({
      updateOne: {
        filter: { _id: plan._id },
        update: { $set: { lastSyncedAt: new Date() } },
      },
    });
    await this.planModel.bulkWrite(ops, { ordered: true });
  }

  private async recoverManual(
    line: LeanLine,
    setLine: (
      line: LeanLine,
      expected: LineStatus,
      set: Record<string, unknown>,
      unset?: Record<string, ''>,
    ) => void,
    pullLine: (line: LeanLine, expected: LineStatus) => void,
  ) {
    const tx = await this.transactionModel
      .findOne({ planLineId: line._id })
      .sort({ createdAt: -1 })
      .lean();
    if (tx && !tx.voidedAt) {
      setLine(
        line,
        'applying',
        {
          'lines.$.status': 'applied',
          'lines.$.transactionId': tx._id,
          'lines.$.appliedAmount': line.appliedAmount ?? line.plannedAmount,
          'lines.$.appliedAccountAmount': tx.amount,
          'lines.$.appliedAccountCurrency': tx.currency,
          'lines.$.appliedDate': tx.date,
          'lines.$.appliedAt': new Date(),
        },
        { 'lines.$.applyStartedAt': '' },
      );
    } else if (line.unplanned) {
      pullLine(line, 'applying');
    } else {
      // Nothing was recorded (or it was voided while undoing): back to planned.
      setLine(
        line,
        'applying',
        { 'lines.$.status': 'planned' },
        this.appliedFieldsUnset(),
      );
    }
  }

  private appliedFromOccurrence(
    occ: SourceOccurrence,
  ): Record<string, unknown> {
    return {
      'lines.$.status': 'applied',
      'lines.$.appliedAmount': round2(occ.paidAmount ?? occ.amount),
      'lines.$.appliedAccountAmount': occ.accountAmount,
      'lines.$.appliedAccountCurrency': occ.accountCurrency,
      'lines.$.appliedExchangeRate': occ.exchangeRate,
      'lines.$.appliedDate': occ.date,
      'lines.$.appliedAt': new Date(),
      'lines.$.transactionId': occ.transactionId,
    };
  }

  private lineFromOccurrence(occ: SourceOccurrence, order: number) {
    const base = {
      _id: new Types.ObjectId(),
      kind: occ.kind,
      source: occ.source,
      sourceId: occ.sourceId,
      sourceOccurrenceId: occ.occurrenceId,
      name: occ.name,
      categoryId: occ.categoryId,
      accountId: occ.accountId,
      plannedAmount: round2(occ.amount),
      currency: occ.currency,
      amountOverridden: false,
      dueDate: occ.date,
      status: 'planned' as LineStatus,
      repeat: false,
      unplanned: false,
      meta: occ.meta,
      order,
    };
    if (occ.status === 'confirmed') {
      return {
        ...base,
        status: 'applied' as LineStatus,
        appliedAmount: round2(occ.paidAmount ?? occ.amount),
        appliedAccountAmount: occ.accountAmount,
        appliedAccountCurrency: occ.accountCurrency,
        appliedExchangeRate: occ.exchangeRate,
        appliedDate: occ.date,
        appliedAt: new Date(),
        transactionId: occ.transactionId,
      };
    }
    if (occ.status === 'omitted') {
      return {
        ...base,
        status: 'skipped' as LineStatus,
        note: OMITTED_AT_SOURCE,
      };
    }
    return base;
  }

  /** Occurrences another fortnight is actively handling (planned, applying or applied there). */
  private async ownedByOtherPlans(
    planId: Types.ObjectId,
    occurrenceIds: Types.ObjectId[],
  ) {
    const owned = new Set<string>();
    if (occurrenceIds.length === 0) return owned;
    const wanted = new Set(occurrenceIds.map((id) => id.toString()));
    const others = (await this.planModel
      .find(
        {
          _id: { $ne: planId },
          'lines.sourceOccurrenceId': { $in: occurrenceIds },
        },
        { 'lines.sourceOccurrenceId': 1, 'lines.status': 1 },
      )
      .lean()) as unknown as Array<{
      lines: Array<{ sourceOccurrenceId?: Types.ObjectId; status: LineStatus }>;
    }>;
    for (const other of others) {
      for (const line of other.lines) {
        const key = line.sourceOccurrenceId?.toString();
        if (key && wanted.has(key) && LIVE_STATUSES.includes(line.status))
          owned.add(key);
      }
    }
    return owned;
  }

  private async fxRate(): Promise<number> {
    const fromSettings = await this.settingsService.getNumber('fxUsdToNio');
    if (fromSettings && fromSettings > 0) return fromSettings;
    const raw = Number(this.config.get<string>('FX_USD_TO_NIO') ?? '36');
    return Number.isFinite(raw) && raw > 0 ? raw : 36;
  }

  private async categoryNames() {
    const categories = await this.categoryModel.find({}, { name: 1 }).lean();
    return new Map(categories.map((c) => [c._id.toString(), c.name]));
  }

  private async accountInfo(): Promise<Map<string, AccountInfo>> {
    const accounts = (await this.accountsService.findAll({
      includeBalance: 'true',
    })) as unknown as Array<{
      _id: Types.ObjectId;
      name: string;
      currency: Currency;
      isActive: boolean;
      currentBalance?: number;
    }>;
    return new Map(
      accounts.map((a) => [
        a._id.toString(),
        {
          _id: a._id.toString(),
          name: a.name,
          currency: a.currency,
          isActive: a.isActive,
          currentBalance: Number(a.currentBalance ?? 0),
        },
      ]),
    );
  }

  private summaryLines(
    lines: LeanLine[],
    categories: Map<string, string>,
  ): SummaryLine[] {
    return lines.map((line) => ({
      kind: line.kind,
      status: line.status,
      plannedAmount: line.plannedAmount,
      appliedAmount: line.appliedAmount,
      currency: line.currency,
      categoryId: line.categoryId?.toString(),
      categoryName: line.categoryId
        ? categories.get(line.categoryId.toString())
        : undefined,
      dueDate: line.dueDate ? new Date(line.dueDate) : undefined,
      unplanned: line.unplanned,
    }));
  }

  /**
   * Income and expense movements dated inside the window that no plan line
   * accounts for: what was spent (or earned) without being planned.
   */
  private async unlinkedTransactions(
    period: FortnightPeriod,
    plan: LeanPlan,
    accounts: Map<string, AccountInfo>,
    categories: Map<string, string>,
  ): Promise<UnlinkedTransaction[]> {
    const candidates = await this.transactionModel
      .find({
        date: { $gte: period.start, $lte: period.end },
        voidedAt: { $exists: false },
        type: { $in: ['income', 'expense'] },
        planLineId: { $exists: false },
      })
      .sort({ date: -1 })
      .lean();
    if (candidates.length === 0) return [];

    const ownIds = new Set(
      plan.lines.map((line) => line.transactionId?.toString()).filter(Boolean),
    );
    const remaining = candidates.filter((tx) => !ownIds.has(tx._id.toString()));
    if (remaining.length === 0) return [];

    // Paid through a line of another fortnight (a carried debt paid late, for instance).
    const elsewhere = (await this.planModel
      .find(
        { 'lines.transactionId': { $in: remaining.map((tx) => tx._id) } },
        { 'lines.transactionId': 1 },
      )
      .lean()) as unknown as Array<{
      lines: Array<{ transactionId?: Types.ObjectId }>;
    }>;
    const linkedElsewhere = new Set(
      elsewhere.flatMap((p) =>
        p.lines.map((line) => line.transactionId?.toString()).filter(Boolean),
      ),
    );

    return remaining
      .filter((tx) => !linkedElsewhere.has(tx._id.toString()))
      .map((tx) => ({
        _id: tx._id.toString(),
        type: tx.type as 'income' | 'expense',
        amount: tx.amount,
        currency: tx.currency,
        date: tx.date,
        categoryId: tx.categoryId?.toString(),
        categoryName: tx.categoryId
          ? categories.get(tx.categoryId.toString())
          : undefined,
        accountName: accounts.get(tx.accountId.toString())?.name,
        reference: tx.reference,
        notes: tx.notes,
      }));
  }

  private async getDetailFresh(period: FortnightPeriod) {
    return this.buildDetail(period, await this.findPlan(period.key));
  }

  private async buildDetail(period: FortnightPeriod, plan: LeanPlan | null) {
    const previous = previousPeriod(period);
    const next = nextPeriod(period);
    const current = periodForDate(new Date());
    const fxRate = await this.fxRate();
    const periodDto = {
      key: period.key,
      label: period.label,
      start: dayString(period.start),
      end: dayString(period.end),
      previousKey: previous.key,
      previousLabel: previous.label,
      nextKey: next.key,
      nextLabel: next.label,
      isCurrent: current.key === period.key,
      isPast: period.end < new Date(),
    };

    if (!plan) {
      const previousPlan = await this.planModel.exists({
        periodKey: previous.key,
        status: 'open',
      });
      return {
        period: periodDto,
        fxRate,
        plan: null,
        summary: null,
        unplannedTransactions: [],
        previousOpen: !!previousPlan,
      };
    }

    const [accounts, categories] = await Promise.all([
      this.accountInfo(),
      this.categoryNames(),
    ]);
    const today = startOfDay(new Date());
    const unlinked = await this.unlinkedTransactions(
      period,
      plan,
      accounts,
      categories,
    );

    const balances =
      plan.status === 'open'
        ? Array.from(accounts.values())
            .filter((a) => a.isActive)
            .map((a) => ({
              currency: a.currency,
              currentBalance: a.currentBalance,
            }))
        : null;

    const live = computeSummary({
      lines: this.summaryLines(plan.lines, categories),
      unlinked,
      balances,
      fxRate,
      now: new Date(),
    });
    const summary =
      plan.status === 'closed' && plan.closingSummary
        ? (plan.closingSummary as unknown as FortnightSummary)
        : live;

    const lines = [...plan.lines]
      .sort((a, b) => {
        const kindOrder = { income: 0, expense: 1, savings: 2 } as const;
        if (kindOrder[a.kind] !== kindOrder[b.kind])
          return kindOrder[a.kind] - kindOrder[b.kind];
        const da = a.dueDate
          ? new Date(a.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        const db = b.dueDate
          ? new Date(b.dueDate).getTime()
          : Number.MAX_SAFE_INTEGER;
        if (da !== db) return da - db;
        return (a.order ?? 0) - (b.order ?? 0);
      })
      .map((line) => {
        const account = line.accountId
          ? accounts.get(line.accountId.toString())
          : undefined;
        const toAccount = line.toAccountId
          ? accounts.get(line.toAccountId.toString())
          : undefined;
        const open = line.status === 'planned' || line.status === 'applying';
        return {
          ...line,
          dueDay: dayString(line.dueDate),
          appliedDay: dayString(line.appliedDate),
          accountName: account?.name ?? null,
          accountCurrency: account?.currency ?? null,
          toAccountName: toAccount?.name ?? null,
          categoryName: line.categoryId
            ? (categories.get(line.categoryId.toString()) ?? null)
            : null,
          overdue: open && !!line.dueDate && new Date(line.dueDate) < today,
          canUndo:
            line.status === 'applied' &&
            (line.source === 'manual' || line.source === 'loan'),
        };
      });

    return {
      period: periodDto,
      fxRate,
      plan: { ...plan, lines },
      summary,
      liveSummary: plan.status === 'closed' ? live : undefined,
      unplannedTransactions: unlinked.map((tx) => ({
        ...tx,
        day: dayString(tx.date),
      })),
      previousOpen: !!(await this.planModel.exists({
        periodKey: previous.key,
        status: 'open',
      })),
    };
  }
}
