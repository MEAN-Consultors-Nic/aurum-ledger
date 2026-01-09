import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreatePlannedIncomeDto } from './dto/create-planned-income.dto';
import { FilterPlannedIncomeDto } from './dto/filter-planned-income.dto';
import { UpdatePlannedIncomeDto } from './dto/update-planned-income.dto';
import { PlannedIncome, PlannedIncomeDocument } from './schemas/planned-income.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceDocument,
} from './schemas/planned-income-occurrence.schema';

@Injectable()
export class PlannedIncomesService {
  private readonly monthsAhead = 12;

  constructor(
    @InjectModel(PlannedIncome.name)
    private readonly plannedIncomeModel: Model<PlannedIncomeDocument>,
    @InjectModel(PlannedIncomeOccurrence.name)
    private readonly occurrenceModel: Model<PlannedIncomeOccurrenceDocument>,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(dto: CreatePlannedIncomeDto, userId?: Types.ObjectId) {
    const account = await this.accountsService.findById(dto.accountId);
    if (account.currency !== dto.currency) {
      throw new BadRequestException('Planned income currency must match account currency');
    }

    const planned = await this.plannedIncomeModel.create({
      name: dto.name,
      amount: dto.amount,
      currency: dto.currency,
      accountId: new Types.ObjectId(dto.accountId),
      categoryId: new Types.ObjectId(dto.categoryId),
      daysOfMonth: dto.daysOfMonth,
      isActive: dto.isActive ?? true,
      notes: dto.notes,
      createdBy: userId,
      updatedBy: userId,
    });

    await this.ensureFutureOccurrences(planned);
    return planned;
  }

  async findAll(filter: FilterPlannedIncomeDto) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }
    return this.plannedIncomeModel
      .find(query)
      .sort({ name: 1 })
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async update(id: string, dto: UpdatePlannedIncomeDto, userId?: Types.ObjectId) {
    const planned = await this.plannedIncomeModel.findById(id);
    if (!planned) {
      throw new NotFoundException('Planned income not found');
    }

    if (dto.accountId || dto.currency) {
      const accountId = dto.accountId ?? planned.accountId.toString();
      const currency = dto.currency ?? planned.currency;
      const account = await this.accountsService.findById(accountId);
      if (account.currency !== currency) {
        throw new BadRequestException('Planned income currency must match account currency');
      }
    }

    planned.name = dto.name ?? planned.name;
    planned.amount = dto.amount ?? planned.amount;
    planned.currency = dto.currency ?? planned.currency;
    planned.accountId = dto.accountId ? new Types.ObjectId(dto.accountId) : planned.accountId;
    planned.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : planned.categoryId;
    planned.daysOfMonth = dto.daysOfMonth ?? planned.daysOfMonth;
    planned.isActive = dto.isActive ?? planned.isActive;
    planned.notes = dto.notes ?? planned.notes;
    planned.updatedBy = userId;

    await planned.save();
    await this.refreshFutureOccurrences(planned);

    return planned;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const planned = await this.plannedIncomeModel.findById(id);
    if (!planned) {
      throw new NotFoundException('Planned income not found');
    }
    planned.isActive = false;
    planned.updatedBy = userId;
    await planned.save();
    return planned;
  }

  async listOccurrences(month?: string) {
    const { start, end, year, monthIndex } = this.parseMonth(month);
    const activePlanned = await this.plannedIncomeModel.find({ isActive: true });

    for (const planned of activePlanned) {
      await this.ensureOccurrencesForMonth(planned, year, monthIndex);
    }

    return this.occurrenceModel
      .find({ date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .populate('plannedIncomeId', 'name')
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async confirmOccurrence(
    id: string,
    payload: { receivedAmount?: number; note?: string },
    userId?: Types.ObjectId,
  ) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Planned income occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be confirmed');
    }

    const planned = await this.plannedIncomeModel.findById(occurrence.plannedIncomeId);
    if (!planned) {
      throw new NotFoundException('Planned income not found');
    }

    const receivedAmount =
      payload.receivedAmount !== undefined ? payload.receivedAmount : occurrence.amount;
    if (receivedAmount < 0) {
      throw new BadRequestException('Received amount must be greater than or equal to 0');
    }
    const feeAmount = Math.max(0, occurrence.amount - receivedAmount);

    const transaction = await this.transactionsService.create(
      {
        type: 'income',
        accountId: occurrence.accountId.toString(),
        categoryId: occurrence.categoryId.toString(),
        amount: receivedAmount,
        currency: occurrence.currency,
        date: occurrence.date.toISOString(),
        reference: `Planned income: ${planned.name}`,
        notes: payload.note || planned.notes,
      },
      userId,
    );

    occurrence.status = 'confirmed';
    occurrence.confirmedTransactionId = transaction._id;
    occurrence.receivedAmount = receivedAmount;
    occurrence.feeAmount = feeAmount;
    occurrence.confirmationNote = payload.note;
    occurrence.updatedBy = userId;
    await occurrence.save();

    return occurrence;
  }

  async omitOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Planned income occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be omitted');
    }

    occurrence.status = 'omitted';
    occurrence.updatedBy = userId;
    await occurrence.save();
    return occurrence;
  }

  async getAlerts(month?: string) {
    const { start, end } = this.parseMonth(month);
    const today = new Date();

    const items = await this.occurrenceModel
      .find({
        status: 'planned',
        date: { $gte: start, $lte: end, $lt: today },
      })
      .sort({ date: 1 })
      .populate('plannedIncomeId', 'name')
      .populate('accountId', 'name currency');

    return {
      count: items.length,
      items,
    };
  }

  async getSummary(month?: string) {
    const { start, end, year, monthIndex } = this.parseMonth(month);
    const activePlanned = await this.plannedIncomeModel.find({ isActive: true });

    for (const planned of activePlanned) {
      await this.ensureOccurrencesForMonth(planned, year, monthIndex);
    }

    const occurrences = await this.occurrenceModel
      .find({ date: { $gte: start, $lte: end } })
      .populate('accountId', 'name currency');

    const summary = {
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      totals: {
        plannedUsd: 0,
        plannedNio: 0,
        confirmedUsd: 0,
        confirmedNio: 0,
        varianceUsd: 0,
        varianceNio: 0,
      },
      byAccount: [] as Array<{
        accountId: string;
        accountName: string;
        currency: 'USD' | 'NIO';
        plannedTotal: number;
        confirmedTotal: number;
        variance: number;
      }>,
    };

    const accountMap = new Map<
      string,
      {
        accountId: string;
        accountName: string;
        currency: 'USD' | 'NIO';
        plannedTotal: number;
        confirmedTotal: number;
      }
    >();

    for (const item of occurrences) {
      if (item.status === 'omitted') {
        continue;
      }
      const accountRef = item.accountId as unknown as {
        _id?: Types.ObjectId;
        name?: string;
        currency?: 'USD' | 'NIO';
      };
      const key = accountRef?._id ? accountRef._id.toString() : String(item.accountId);
      if (!accountMap.has(key)) {
        accountMap.set(key, {
          accountId: key,
          accountName: accountRef?.name ?? key,
          currency: accountRef?.currency ?? item.currency,
          plannedTotal: 0,
          confirmedTotal: 0,
        });
      }
      const bucket = accountMap.get(key);
      if (bucket) {
        bucket.plannedTotal += item.amount;
        if (item.status === 'confirmed') {
          const confirmedAmount = item.receivedAmount ?? item.amount;
          bucket.confirmedTotal += confirmedAmount;
        }
      }

      if (item.currency === 'USD') {
        summary.totals.plannedUsd += item.amount;
        if (item.status === 'confirmed') {
          summary.totals.confirmedUsd += item.receivedAmount ?? item.amount;
        }
      } else {
        summary.totals.plannedNio += item.amount;
        if (item.status === 'confirmed') {
          summary.totals.confirmedNio += item.receivedAmount ?? item.amount;
        }
      }
    }

    summary.totals.varianceUsd = summary.totals.plannedUsd - summary.totals.confirmedUsd;
    summary.totals.varianceNio = summary.totals.plannedNio - summary.totals.confirmedNio;

    summary.byAccount = Array.from(accountMap.values()).map((item) => ({
      ...item,
      variance: item.plannedTotal - item.confirmedTotal,
    }));

    return summary;
  }

  private parseMonth(month?: string) {
    const now = new Date();
    let year = now.getFullYear();
    let monthIndex = now.getMonth();

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      year = Number(yearStr);
      monthIndex = Math.max(0, Number(monthStr) - 1);
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    return { start, end, year, monthIndex };
  }

  private normalizeDays(days: number[], year: number, monthIndex: number) {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const sanitized = days.map((day) => Math.min(Math.max(day, 1), daysInMonth));
    return Array.from(new Set(sanitized)).sort((a, b) => a - b);
  }

  private async ensureOccurrencesForMonth(
    planned: PlannedIncomeDocument,
    year: number,
    monthIndex: number,
  ) {
    const days = this.normalizeDays(planned.daysOfMonth ?? [], year, monthIndex);
    if (days.length === 0) {
      return;
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const existing = await this.occurrenceModel.find({
      plannedIncomeId: planned._id,
      date: { $gte: start, $lte: end },
    });

    const existingDays = new Set(existing.map((item) => item.date.getDate()));

    for (const day of days) {
      if (existingDays.has(day)) {
        continue;
      }
      await this.occurrenceModel.create({
        plannedIncomeId: planned._id,
        accountId: planned.accountId,
        categoryId: planned.categoryId,
        date: new Date(year, monthIndex, day),
        amount: planned.amount,
        currency: planned.currency,
        status: 'planned',
      });
    }
  }

  private async ensureFutureOccurrences(planned: PlannedIncomeDocument) {
    const now = new Date();
    for (let offset = 0; offset < this.monthsAhead; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      await this.ensureOccurrencesForMonth(planned, date.getFullYear(), date.getMonth());
    }
  }

  private async refreshFutureOccurrences(planned: PlannedIncomeDocument) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    await this.occurrenceModel.deleteMany({
      plannedIncomeId: planned._id,
      status: 'planned',
      date: { $gte: start },
    });

    await this.ensureFutureOccurrences(planned);
  }
}
