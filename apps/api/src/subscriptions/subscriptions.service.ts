import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { FilterSubscriptionDto } from './dto/filter-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription, SubscriptionDocument } from './schemas/subscription.schema';
import { SubscriptionOccurrence, SubscriptionOccurrenceDocument } from './schemas/subscription-occurrence.schema';

@Injectable()
export class SubscriptionsService {
  private readonly monthsAhead = 12;

  constructor(
    @InjectModel(Subscription.name) private readonly subscriptionModel: Model<SubscriptionDocument>,
    @InjectModel(SubscriptionOccurrence.name)
    private readonly occurrenceModel: Model<SubscriptionOccurrenceDocument>,
    private readonly accountsService: AccountsService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(dto: CreateSubscriptionDto, userId?: Types.ObjectId) {
    const account = await this.accountsService.findById(dto.accountId);
    if (account.currency !== dto.currency) {
      throw new BadRequestException('Subscription currency must match account currency');
    }

    const subscription = await this.subscriptionModel.create({
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

    await this.ensureFutureOccurrences(subscription);
    return subscription;
  }

  async findAll(filter: FilterSubscriptionDto) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }
    return this.subscriptionModel
      .find(query)
      .sort({ name: 1 })
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async update(id: string, dto: UpdateSubscriptionDto, userId?: Types.ObjectId) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    if (dto.accountId || dto.currency) {
      const accountId = dto.accountId ?? subscription.accountId.toString();
      const currency = dto.currency ?? subscription.currency;
      const account = await this.accountsService.findById(accountId);
      if (account.currency !== currency) {
        throw new BadRequestException('Subscription currency must match account currency');
      }
    }

    subscription.name = dto.name ?? subscription.name;
    subscription.amount = dto.amount ?? subscription.amount;
    subscription.currency = dto.currency ?? subscription.currency;
    subscription.accountId = dto.accountId ? new Types.ObjectId(dto.accountId) : subscription.accountId;
    subscription.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : subscription.categoryId;
    subscription.daysOfMonth = dto.daysOfMonth ?? subscription.daysOfMonth;
    subscription.isActive = dto.isActive ?? subscription.isActive;
    subscription.notes = dto.notes ?? subscription.notes;
    subscription.updatedBy = userId;

    await subscription.save();
    await this.refreshFutureOccurrences(subscription);

    return subscription;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const subscription = await this.subscriptionModel.findById(id);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }
    subscription.isActive = false;
    subscription.updatedBy = userId;
    await subscription.save();
    return subscription;
  }

  async listOccurrences(month?: string) {
    const { start, end, year, monthIndex } = this.parseMonth(month);
    const activeSubscriptions = await this.subscriptionModel.find({ isActive: true });

    for (const subscription of activeSubscriptions) {
      await this.ensureOccurrencesForMonth(subscription, year, monthIndex);
    }

    return this.occurrenceModel
      .find({ date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .populate('subscriptionId', 'name')
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async confirmOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Subscription occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be confirmed');
    }

    const subscription = await this.subscriptionModel.findById(occurrence.subscriptionId);
    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    const transaction = await this.transactionsService.create(
      {
        type: 'expense',
        accountId: occurrence.accountId.toString(),
        categoryId: occurrence.categoryId.toString(),
        amount: occurrence.amount,
        currency: occurrence.currency,
        date: occurrence.date.toISOString(),
        reference: `Subscription: ${subscription.name}`,
        notes: subscription.notes,
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
      throw new NotFoundException('Subscription occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be omitted');
    }

    occurrence.status = 'omitted';
    occurrence.updatedBy = userId;
    await occurrence.save();
    return occurrence;
  }

  async reactivateOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Subscription occurrence not found');
    }
    if (occurrence.status !== 'omitted') {
      throw new BadRequestException('Only omitted occurrences can be reactivated');
    }

    occurrence.status = 'planned';
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
      .populate('subscriptionId', 'name')
      .populate('accountId', 'name currency');

    return { count: items.length, items };
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
    subscription: SubscriptionDocument,
    year: number,
    monthIndex: number,
  ) {
    const days = this.normalizeDays(subscription.daysOfMonth ?? [], year, monthIndex);
    if (days.length === 0) {
      return;
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const existing = await this.occurrenceModel.find({
      subscriptionId: subscription._id,
      date: { $gte: start, $lte: end },
    });

    const existingDays = new Set(existing.map((item) => item.date.getDate()));

    for (const day of days) {
      if (existingDays.has(day)) {
        continue;
      }
      await this.occurrenceModel.create({
        subscriptionId: subscription._id,
        accountId: subscription.accountId,
        categoryId: subscription.categoryId,
        date: new Date(year, monthIndex, day),
        amount: subscription.amount,
        currency: subscription.currency,
        status: 'planned',
      });
    }
  }

  private async ensureFutureOccurrences(subscription: SubscriptionDocument) {
    const now = new Date();
    for (let offset = 0; offset < this.monthsAhead; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      await this.ensureOccurrencesForMonth(subscription, date.getFullYear(), date.getMonth());
    }
  }

  private async refreshFutureOccurrences(subscription: SubscriptionDocument) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    await this.occurrenceModel.deleteMany({
      subscriptionId: subscription._id,
      status: 'planned',
      date: { $gte: start },
    });

    await this.ensureFutureOccurrences(subscription);
  }
}
