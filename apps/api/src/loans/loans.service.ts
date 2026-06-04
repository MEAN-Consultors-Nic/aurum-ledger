import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreateLoanDto } from './dto/create-loan.dto';
import { FilterLoanDto } from './dto/filter-loan.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { Loan, LoanDocument } from './schemas/loan.schema';
import { LoanPaymentOccurrence, LoanPaymentOccurrenceDocument } from './schemas/loan-payment-occurrence.schema';

@Injectable()
export class LoansService {
  private readonly monthsAhead = 12;

  constructor(
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectModel(LoanPaymentOccurrence.name)
    private readonly occurrenceModel: Model<LoanPaymentOccurrenceDocument>,
    private readonly accountsService: AccountsService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly transactionsService: TransactionsService,
  ) {}

  async create(dto: CreateLoanDto, userId?: Types.ObjectId) {
    const account = await this.accountsService.findById(dto.accountId);
    if (account.currency !== dto.currency) {
      throw new BadRequestException('Loan currency must match account currency');
    }

    const loan = await this.loanModel.create({
      name: dto.name,
      principal: dto.principal,
      installmentAmount: dto.installmentAmount,
      currency: dto.currency,
      accountId: new Types.ObjectId(dto.accountId),
      categoryId: new Types.ObjectId(dto.categoryId),
      daysOfMonth: dto.daysOfMonth,
      isActive: dto.isActive ?? true,
      notes: dto.notes,
      createdBy: userId,
      updatedBy: userId,
    });

    await this.recurringExpensesService.create(
      {
        name: `Loan payment: ${dto.name}`,
        amount: dto.installmentAmount,
        currency: dto.currency,
        accountId: dto.accountId,
        categoryId: dto.categoryId,
        daysOfMonth: dto.daysOfMonth,
        isActive: dto.isActive ?? true,
        notes: dto.notes,
      },
      userId,
    );

    await this.ensureFutureOccurrences(loan);
    return loan;
  }

  async findAll(filter: FilterLoanDto) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }
    return this.loanModel
      .find(query)
      .sort({ name: 1 })
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async update(id: string, dto: UpdateLoanDto, userId?: Types.ObjectId) {
    const loan = await this.loanModel.findById(id);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (dto.accountId || dto.currency) {
      const accountId = dto.accountId ?? loan.accountId.toString();
      const currency = dto.currency ?? loan.currency;
      const account = await this.accountsService.findById(accountId);
      if (account.currency !== currency) {
        throw new BadRequestException('Loan currency must match account currency');
      }
    }

    loan.name = dto.name ?? loan.name;
    loan.principal = dto.principal ?? loan.principal;
    loan.installmentAmount = dto.installmentAmount ?? loan.installmentAmount;
    loan.currency = dto.currency ?? loan.currency;
    loan.accountId = dto.accountId ? new Types.ObjectId(dto.accountId) : loan.accountId;
    loan.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : loan.categoryId;
    loan.daysOfMonth = dto.daysOfMonth ?? loan.daysOfMonth;
    loan.isActive = dto.isActive ?? loan.isActive;
    loan.notes = dto.notes ?? loan.notes;
    loan.updatedBy = userId;

    await loan.save();
    await this.refreshFutureOccurrences(loan);

    return loan;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const loan = await this.loanModel.findById(id);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    loan.isActive = false;
    loan.updatedBy = userId;
    await loan.save();
    return loan;
  }

  async listOccurrences(month?: string) {
    const { start, end, year, monthIndex } = this.parseMonth(month);
    const activeLoans = await this.loanModel.find({ isActive: true });

    for (const loan of activeLoans) {
      await this.ensureOccurrencesForMonth(loan, year, monthIndex);
    }

    return this.occurrenceModel
      .find({ date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .populate('loanId', 'name')
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
  }

  async confirmOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Loan payment occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be confirmed');
    }

    const loan = await this.loanModel.findById(occurrence.loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    const transaction = await this.transactionsService.create(
      {
        type: 'expense',
        accountId: occurrence.accountId.toString(),
        categoryId: occurrence.categoryId.toString(),
        amount: occurrence.amount,
        currency: occurrence.currency,
        date: occurrence.date.toISOString(),
        reference: `Loan payment: ${loan.name}`,
        notes: loan.notes,
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
      throw new NotFoundException('Loan payment occurrence not found');
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
      .populate('loanId', 'name')
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

  private async ensureOccurrencesForMonth(loan: LoanDocument, year: number, monthIndex: number) {
    const days = this.normalizeDays(loan.daysOfMonth ?? [], year, monthIndex);
    if (days.length === 0) {
      return;
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    const existing = await this.occurrenceModel.find({
      loanId: loan._id,
      date: { $gte: start, $lte: end },
    });

    const existingDays = new Set(existing.map((item) => item.date.getDate()));

    for (const day of days) {
      if (existingDays.has(day)) {
        continue;
      }
      await this.occurrenceModel.create({
        loanId: loan._id,
        accountId: loan.accountId,
        categoryId: loan.categoryId,
        date: new Date(year, monthIndex, day),
        amount: loan.installmentAmount,
        currency: loan.currency,
        status: 'planned',
      });
    }
  }

  private async ensureFutureOccurrences(loan: LoanDocument) {
    const now = new Date();
    for (let offset = 0; offset < this.monthsAhead; offset += 1) {
      const date = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      await this.ensureOccurrencesForMonth(loan, date.getFullYear(), date.getMonth());
    }
  }

  private async refreshFutureOccurrences(loan: LoanDocument) {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    await this.occurrenceModel.deleteMany({
      loanId: loan._id,
      status: 'planned',
      date: { $gte: start },
    });

    await this.ensureFutureOccurrences(loan);
  }
}
