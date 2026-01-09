import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateRecurringExpenseDto } from './dto/create-recurring-expense.dto';
import { FilterRecurringExpenseDto } from './dto/filter-recurring-expense.dto';
import { UpdateRecurringExpenseDto } from './dto/update-recurring-expense.dto';
import { RecurringExpense, RecurringExpenseDocument } from './schemas/recurring-expense.schema';
import {
  RecurringExpenseOccurrence,
  RecurringExpenseOccurrenceDocument,
} from './schemas/recurring-expense-occurrence.schema';

@Injectable()
export class RecurringExpensesService {
  private readonly monthsAhead = 12;

  constructor(
    @InjectModel(RecurringExpense.name)
    private readonly recurringExpenseModel: Model<RecurringExpenseDocument>,
    @InjectModel(RecurringExpenseOccurrence.name)
    private readonly occurrenceModel: Model<RecurringExpenseOccurrenceDocument>,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(dto: CreateRecurringExpenseDto, userId?: Types.ObjectId) {
    const account = await this.accountsService.findById(dto.accountId);
    if (account.currency !== dto.currency) {
      throw new BadRequestException('Recurring expense currency must match account currency');
    }

    const recurring = await this.recurringExpenseModel.create({
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

    await this.ensureFutureOccurrences(recurring);
    return recurring;
  }

  async findAll(filter: FilterRecurringExpenseDto) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }
    return this.recurringExpenseModel
      .find(query)
      .sort({ name: 1 })
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async update(id: string, dto: UpdateRecurringExpenseDto, userId?: Types.ObjectId) {
    const recurring = await this.recurringExpenseModel.findById(id);
    if (!recurring) {
      throw new NotFoundException('Recurring expense not found');
    }

    if (dto.accountId || dto.currency) {
      const accountId = dto.accountId ?? recurring.accountId.toString();
      const currency = dto.currency ?? recurring.currency;
      const account = await this.accountsService.findById(accountId);
      if (account.currency !== currency) {
        throw new BadRequestException('Recurring expense currency must match account currency');
      }
    }

    recurring.name = dto.name ?? recurring.name;
    recurring.amount = dto.amount ?? recurring.amount;
    recurring.currency = dto.currency ?? recurring.currency;
    recurring.accountId = dto.accountId ? new Types.ObjectId(dto.accountId) : recurring.accountId;
    recurring.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : recurring.categoryId;
    recurring.daysOfMonth = dto.daysOfMonth ?? recurring.daysOfMonth;
    recurring.isActive = dto.isActive ?? recurring.isActive;
    recurring.notes = dto.notes ?? recurring.notes;
    recurring.updatedBy = userId;

    await recurring.save();
    await this.refreshFutureOccurrences(recurring);

    return recurring;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const recurring = await this.recurringExpenseModel.findById(id);
    if (!recurring) {
      throw new NotFoundException('Recurring expense not found');
    }
    recurring.isActive = false;
    recurring.updatedBy = userId;
    await recurring.save();
    return recurring;
  }

  async listOccurrences(month?: string) {
    const { start, end, year, monthIndex } = this.parseMonth(month);
    const activeRecurring = await this.recurringExpenseModel.find({ isActive: true });

    for (const recurring of activeRecurring) {
      await this.ensureOccurrencesForMonth(recurring, year, monthIndex);
    }

    return this.occurrenceModel
      .find({ date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .populate('recurringExpenseId', 'name')
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async confirmOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Recurring expense occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be confirmed');
    }

    const recurring = await this.recurringExpenseModel.findById(occurrence.recurringExpenseId);
    if (!recurring) {
      throw new NotFoundException('Recurring expense not found');
    }

    const transaction = await this.transactionsService.create(
      {
        type: 'expense',
        accountId: occurrence.accountId.toString(),
        categoryId: occurrence.categoryId.toString(),
        amount: occurrence.amount,
        currency: occurrence.currency,
        date: occurrence.date.toISOString(),
        reference: `Recurring expense: ${recurring.name}`,
        notes: recurring.notes,
      },
      userId,
    );

    occurrence.status = 'confirmed';
    occurrence.confirmedTransactionId = transaction._id;
    occurrence.updatedBy = userId;
    await occurrence.save();

    return occurrence;
  }

  async omitOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Recurring expense occurrence not found');
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
      .populate('recurringExpenseId', 'name')
      .populate('accountId', 'name currency');

    return {
      count: items.length,
      items,
    };
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
    recurring: RecurringExpenseDocument,
    year: number,
    monthIndex: number,
  ) {
    const days = this.normalizeDays(recurring.daysOfMonth ?? [], year, monthIndex);
    if (days.length === 0) {
      return;
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const existing = await this.occurrenceModel.find({
      recurringExpenseId: recurring._id,
      date: { $gte: start, $lte: end },
    });

    const existingDays = new Set(existing.map((item) => item.date.getDate()));

    for (const day of days) {
      if (existingDays.has(day)) {
        continue;
      }
      await this.occurrenceModel.create({
        recurringExpenseId: recurring._id,
        accountId: recurring.accountId,
        categoryId: recurring.categoryId,
        date: new Date(year, monthIndex, day),
        amount: recurring.amount,
        currency: recurring.currency,
        status: 'planned',
      });
    }
  }

  private async ensureFutureOccurrences(recurring: RecurringExpenseDocument) {
    const now = new Date();
    for (let offset = 0; offset < this.monthsAhead; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      await this.ensureOccurrencesForMonth(recurring, date.getFullYear(), date.getMonth());
    }
  }

  private async refreshFutureOccurrences(recurring: RecurringExpenseDocument) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    await this.occurrenceModel.deleteMany({
      recurringExpenseId: recurring._id,
      status: 'planned',
      date: { $gte: start },
    });

    await this.ensureFutureOccurrences(recurring);
  }
}
