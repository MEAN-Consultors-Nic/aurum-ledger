import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { ConfigService } from '@nestjs/config';
import { RecurringExpensesService } from '../recurring-expenses/recurring-expenses.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionsService } from '../transactions/transactions.service';
import { ConfirmLoanPaymentDto } from './dto/confirm-occurrence.dto';
import { CreateLoanDto } from './dto/create-loan.dto';
import { FilterLoanDto } from './dto/filter-loan.dto';
import { LoanProjectionQueryDto } from './dto/projection-query.dto';
import { UpdateLoanDto } from './dto/update-loan.dto';
import { Loan, LoanDocument } from './schemas/loan.schema';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceDocument,
} from './schemas/loan-payment-occurrence.schema';

/** Money is kept to cents; everything rounds through here. */
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

@Injectable()
export class LoansService {
  private readonly monthsAhead = 12;
  private readonly maxScheduledPeriods = 60;

  constructor(
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectModel(LoanPaymentOccurrence.name)
    private readonly occurrenceModel: Model<LoanPaymentOccurrenceDocument>,
    private readonly accountsService: AccountsService,
    private readonly recurringExpensesService: RecurringExpensesService,
    private readonly settingsService: SettingsService,
    private readonly transactionsService: TransactionsService,
    private readonly config: ConfigService,
  ) {}

  /**
   * One global rate (córdobas per dollar) from Settings, so a payment is
   * never asked for its own. Falls back to FX_USD_TO_NIO, then 36.
   */
  private async fxRate(): Promise<number> {
    const fromSettings = await this.settingsService.getNumber('fxUsdToNio');
    if (fromSettings && fromSettings > 0) {
      return fromSettings;
    }
    const raw = Number(this.config.get<string>('FX_USD_TO_NIO') ?? '36');
    return Number.isFinite(raw) && raw > 0 ? raw : 36;
  }

  /**
   * A debt is denominated in its own currency and may be paid from an
   * account in the other one: a córdoba debt settled from a dollar account
   * debits the dollar equivalent at the global rate.
   */
  private convert(amount: number, from: 'USD' | 'NIO', to: 'USD' | 'NIO', rate: number) {
    if (from === to) return money(amount);
    return to === 'USD' ? money(amount / rate) : money(amount * rate);
  }

  // ---------------------------------------------------------------- loans

  async create(dto: CreateLoanDto, userId?: Types.ObjectId) {
    // The debt's currency is independent of the account that pays it.
    await this.accountsService.findById(dto.accountId);
    this.assertShape(dto);

    const loan = await this.loanModel.create({
      name: dto.name,
      kind: dto.kind,
      principal: dto.principal,
      currentBalance: dto.principal,
      currency: dto.currency,
      accountId: new Types.ObjectId(dto.accountId),
      categoryId: new Types.ObjectId(dto.categoryId),
      scheduleType: dto.scheduleType,
      daysOfMonth: dto.scheduleType === 'monthly_days' ? dto.daysOfMonth : [],
      intervalDays: dto.scheduleType === 'interval_days' ? dto.intervalDays : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : new Date(),
      installmentAmount: dto.kind === 'fixed_installment' ? dto.installmentAmount : 0,
      totalInstallments: dto.totalInstallments,
      interestRatePercent: dto.kind === 'interest_bearing' ? dto.interestRatePercent : 0,
      status: 'active',
      isActive: dto.isActive ?? true,
      notes: dto.notes,
      createdBy: userId,
      updatedBy: userId,
    });

    // NOTE: loans deliberately no longer create a shadow recurring expense.
    // Doing so recorded every loan payment twice in the books.
    await this.rebuildSchedule(loan);
    return loan;
  }

  async findAll(filter: FilterLoanDto) {
    const query: Record<string, unknown> = {};
    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }
    const loans = await this.loanModel
      .find(query)
      .sort({ status: 1, name: 1 })
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');

    return Promise.all(loans.map((loan) => this.decorateWithFx(loan)));
  }

  async findById(id: string) {
    const loan = await this.loanModel
      .findById(id)
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type');
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    return this.decorateWithFx(loan);
  }

  async update(id: string, dto: UpdateLoanDto, userId?: Types.ObjectId) {
    const loan = await this.loanModel.findById(id);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    if (dto.accountId) {
      await this.accountsService.findById(dto.accountId);
    }

    const confirmedCount = await this.occurrenceModel.countDocuments({
      loanId: loan._id,
      status: 'confirmed',
    });

    loan.name = dto.name ?? loan.name;
    loan.kind = dto.kind ?? loan.kind;
    loan.currency = dto.currency ?? loan.currency;
    loan.accountId = dto.accountId ? new Types.ObjectId(dto.accountId) : loan.accountId;
    loan.categoryId = dto.categoryId ? new Types.ObjectId(dto.categoryId) : loan.categoryId;
    loan.scheduleType = dto.scheduleType ?? loan.scheduleType;
    loan.daysOfMonth = dto.daysOfMonth ?? loan.daysOfMonth;
    loan.intervalDays = dto.intervalDays ?? loan.intervalDays;
    loan.startDate = dto.startDate ? new Date(dto.startDate) : loan.startDate;
    loan.installmentAmount = dto.installmentAmount ?? loan.installmentAmount;
    loan.totalInstallments = dto.totalInstallments ?? loan.totalInstallments;
    loan.interestRatePercent = dto.interestRatePercent ?? loan.interestRatePercent;
    loan.isActive = dto.isActive ?? loan.isActive;
    loan.notes = dto.notes ?? loan.notes;
    loan.updatedBy = userId;

    // Terms — the kind of debt, its rate and its schedule — can always be
    // changed: a credit that turns into an interest-bearing loan is an
    // ordinary thing to happen. The numbers are what need care.
    if (confirmedCount === 0) {
      // Nothing has been paid yet, so the principal is still just a figure.
      if (dto.principal !== undefined) {
        loan.principal = dto.principal;
        loan.currentBalance = dto.principal;
      }
      if (dto.currentBalance !== undefined) {
        loan.currentBalance = money(dto.currentBalance);
      }
    } else {
      // Payments exist, so principal stays as the historical figure and the
      // outstanding balance is re-baselined explicitly, with a trail.
      if (dto.currentBalance !== undefined && money(dto.currentBalance) !== money(loan.currentBalance)) {
        const previous = money(loan.currentBalance);
        loan.currentBalance = money(dto.currentBalance);
        loan.rebaselinedAt = new Date();
        loan.rebaselineNote = [
          loan.rebaselineNote,
          `${new Date().toISOString().slice(0, 10)}: balance set from ${previous.toFixed(2)} to ${loan.currentBalance.toFixed(2)}`,
        ]
          .filter(Boolean)
          .join(' · ');
      }
      if (dto.principal !== undefined && money(dto.principal) !== money(loan.principal)) {
        throw new BadRequestException(
          'This debt already has confirmed payments, so the original amount stays as it was recorded. Correct the outstanding balance instead — that is what the interest and the payments work from.',
        );
      }
    }

    if (loan.status === 'settled' && loan.currentBalance > 0) {
      loan.status = 'active';
      loan.settledAt = undefined;
    }

    this.assertShape(loan);
    await loan.save();
    await this.rebuildSchedule(loan);

    return this.decorateWithFx(loan);
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const loan = await this.loanModel.findById(id);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }
    loan.isActive = false;
    loan.status = 'cancelled';
    loan.updatedBy = userId;
    await loan.save();
    await this.occurrenceModel.deleteMany({ loanId: loan._id, status: 'planned' });
    return loan;
  }

  // ----------------------------------------------------------- occurrences

  async listOccurrences(month?: string) {
    const { start, end } = this.parseMonth(month);
    return this.occurrenceModel
      .find({ date: { $gte: start, $lte: end } })
      .sort({ date: 1 })
      .populate('loanId', 'name kind interestRatePercent currentBalance')
      .populate('accountId', 'name currency');
  }

  async confirmOccurrence(id: string, dto: ConfirmLoanPaymentDto, userId?: Types.ObjectId) {
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

    const paidAmount = money(dto.paidAmount ?? occurrence.amount);
    if (paidAmount <= 0) {
      throw new BadRequestException('The amount paid must be greater than zero');
    }

    const balanceBefore = money(loan.currentBalance);
    const split = this.splitPayment(loan, balanceBefore, paidAmount);

    const paidDate = dto.paidDate ? new Date(dto.paidDate) : occurrence.date;
    const account = await this.accountsService.findById(occurrence.accountId.toString());
    const rate = await this.fxRate();
    const accountAmount = this.convert(paidAmount, loan.currency, account.currency, rate);

    const transaction = await this.transactionsService.create(
      {
        type: 'expense',
        accountId: occurrence.accountId.toString(),
        categoryId: occurrence.categoryId.toString(),
        amount: accountAmount,
        currency: account.currency,
        exchangeRate: account.currency === loan.currency ? undefined : rate,
        date: paidDate.toISOString(),
        reference: `Loan payment: ${loan.name}`,
        notes: this.transactionNote(loan, split, {
          paidAmount,
          accountAmount,
          rate,
          debtCurrency: loan.currency,
          accountCurrency: account.currency,
        }),
      },
      userId,
    );

    occurrence.status = 'confirmed';
    occurrence.paidAmount = paidAmount;
    occurrence.balanceBefore = balanceBefore;
    occurrence.balanceAfter = split.balanceAfter;
    occurrence.interestDue = split.interestDue;
    occurrence.interestPaid = split.interestPaid;
    occurrence.principalPaid = split.principalPaid;
    occurrence.interestCapitalized = split.interestCapitalized;
    occurrence.accountCurrency = account.currency;
    occurrence.accountAmount = accountAmount;
    occurrence.exchangeRate = account.currency === loan.currency ? 1 : rate;
    occurrence.note = dto.note;
    occurrence.confirmedTransactionId = transaction._id;
    occurrence.updatedBy = userId;
    await occurrence.save();

    loan.currentBalance = split.balanceAfter;
    loan.interestPaidTotal = money(loan.interestPaidTotal + split.interestPaid);
    loan.principalPaidTotal = money(loan.principalPaidTotal + split.principalPaid);
    loan.capitalizedInterest = money(loan.capitalizedInterest + split.interestCapitalized);
    loan.updatedBy = userId;
    await loan.save();

    await this.afterBalanceChange(loan);
    return this.occurrenceModel.findById(occurrence._id);
  }

  async omitOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Loan payment occurrence not found');
    }
    if (occurrence.status !== 'planned') {
      throw new BadRequestException('Only planned occurrences can be omitted');
    }

    const loan = await this.loanModel.findById(occurrence.loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    occurrence.status = 'omitted';
    occurrence.balanceBefore = money(loan.currentBalance);

    if (loan.kind === 'interest_bearing') {
      // Nothing was paid, so the whole interest for the period is added to
      // the balance and will itself earn interest next period.
      const interestDue = this.interestFor(loan, loan.currentBalance);
      occurrence.interestDue = interestDue;
      occurrence.interestCapitalized = interestDue;
      occurrence.balanceAfter = money(loan.currentBalance + interestDue);

      loan.currentBalance = occurrence.balanceAfter;
      loan.capitalizedInterest = money(loan.capitalizedInterest + interestDue);
      loan.updatedBy = userId;
      await loan.save();
    } else {
      occurrence.balanceAfter = occurrence.balanceBefore;
    }

    occurrence.updatedBy = userId;
    await occurrence.save();

    await this.afterBalanceChange(loan);
    return occurrence;
  }

  async reactivateOccurrence(id: string, userId?: Types.ObjectId) {
    const occurrence = await this.occurrenceModel.findById(id);
    if (!occurrence) {
      throw new NotFoundException('Loan payment occurrence not found');
    }
    if (occurrence.status !== 'omitted') {
      throw new BadRequestException('Only omitted occurrences can be reactivated');
    }

    const loan = await this.loanModel.findById(occurrence.loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // Undoing the capitalisation is only safe while nothing later has been
    // settled on top of it.
    const laterSettled = await this.occurrenceModel.countDocuments({
      loanId: loan._id,
      date: { $gt: occurrence.date },
      status: { $in: ['confirmed', 'omitted'] },
    });
    if (laterSettled > 0) {
      throw new BadRequestException(
        'A later payment has already been settled on this loan, so this one can no longer be reactivated. Adjust the newer payments first.',
      );
    }

    if (occurrence.interestCapitalized > 0) {
      loan.currentBalance = money(loan.currentBalance - occurrence.interestCapitalized);
      loan.capitalizedInterest = money(
        Math.max(0, loan.capitalizedInterest - occurrence.interestCapitalized),
      );
      loan.updatedBy = userId;
      await loan.save();
    }

    occurrence.status = 'planned';
    occurrence.interestCapitalized = 0;
    occurrence.balanceAfter = 0;
    occurrence.amount =
      loan.kind === 'interest_bearing'
        ? this.interestFor(loan, loan.currentBalance)
        : loan.installmentAmount;
    occurrence.interestDue =
      loan.kind === 'interest_bearing' ? this.interestFor(loan, loan.currentBalance) : 0;
    occurrence.updatedBy = userId;
    await occurrence.save();

    await this.afterBalanceChange(loan);
    return occurrence;
  }

  async getAlerts(month?: string) {
    const { start, end } = this.parseMonth(month);
    const today = new Date();

    const items = await this.occurrenceModel
      .find({ status: 'planned', date: { $gte: start, $lte: end, $lt: today } })
      .sort({ date: 1 })
      .populate('loanId', 'name kind')
      .populate('accountId', 'name currency');

    return { count: items.length, items };
  }

  // ------------------------------------------------------------- schedule

  /**
   * History of what really happened, plus — for an open-payment loan — a
   * simulation of what follows if a given amount is paid each period. The
   * future of such a loan is not knowable: it depends on what gets paid.
   */
  async getSchedule(loanId: string, query: LoanProjectionQueryDto) {
    const loan = await this.loanModel.findById(loanId);
    if (!loan) {
      throw new NotFoundException('Loan not found');
    }

    // The simulation continues from the next payment already on the
    // calendar, so it never overlaps dates that are already history.
    const nextPlanned = await this.occurrenceModel
      .findOne({ loanId: loan._id, status: 'planned' })
      .sort({ date: 1 });
    const lastSettled = await this.occurrenceModel
      .findOne({ loanId: loan._id, status: { $in: ['confirmed', 'omitted'] } })
      .sort({ date: -1 });
    const projectionStart = nextPlanned
      ? new Date(nextPlanned.date)
      : lastSettled
        ? this.nextDateAfter(loan, lastSettled.date)
        : this.firstDate(loan);

    const history = await this.occurrenceModel
      .find({ loanId: loan._id, status: { $in: ['confirmed', 'omitted'] } })
      .sort({ date: 1 });

    const rows = history.map((item, index) => ({
      sequence: index + 1,
      date: item.date,
      status: item.status,
      paid: item.paidAmount ?? 0,
      interest: item.interestPaid,
      principal: item.principalPaid,
      capitalized: item.interestCapitalized,
      balanceAfter: item.balanceAfter,
      actual: true as const,
    }));

    const projection = this.project(loan, query, rows.length, projectionStart);

    return {
      loan: await this.decorateWithFx(loan),
      history: rows,
      projection: projection.rows,
      projectionBasis: projection.basis,
      projectionIsSimulation: loan.kind === 'interest_bearing',
      projectionNote:
        loan.kind === 'interest_bearing'
          ? 'A simulation, not a schedule: it assumes the same amount is paid every period. Paying more or less changes everything that follows.'
          : 'Fixed instalments with no interest, so the remaining schedule is exact.',
    };
  }

  private project(
    loan: LoanDocument,
    query: LoanProjectionQueryDto,
    offset: number,
    startDate: Date,
  ) {
    const maxPeriods = Math.min(query.maxPeriods ?? this.maxScheduledPeriods, 600);
    const rows: Array<Record<string, unknown>> = [];

    let balance = money(loan.currentBalance);
    if (balance <= 0 || loan.status !== 'active') {
      return { rows, basis: 0 };
    }

    const payment =
      loan.kind === 'fixed_installment'
        ? money(loan.installmentAmount)
        : money(query.paymentPerPeriod ?? this.defaultProjectionPayment(loan));

    if (payment <= 0) {
      return { rows, basis: payment };
    }

    let date = new Date(startDate);

    for (let index = 0; index < maxPeriods && balance > 0; index += 1) {
      const interest = this.interestFor(loan, balance);

      // A payment that does not even cover the interest never pays the loan
      // off; say so instead of looping to the cap.
      if (loan.kind === 'interest_bearing' && payment <= interest) {
        return {
          rows,
          basis: payment,
          neverSettles: true,
        } as { rows: Array<Record<string, unknown>>; basis: number; neverSettles: boolean };
      }

      const principal = Math.min(money(payment - interest), balance);
      const balanceAfter = money(balance - principal);

      rows.push({
        sequence: offset + index + 1,
        date: new Date(date),
        status: 'projected',
        paid: money(interest + principal),
        interest,
        principal,
        capitalized: 0,
        balanceAfter,
        actual: false,
      });

      balance = balanceAfter;
      date = this.nextDateAfter(loan, date);
    }

    return { rows, basis: payment };
  }

  private defaultProjectionPayment(loan: LoanDocument) {
    // Without a hypothesis, assume the interest plus a tenth of the balance,
    // which at least converges and shows the shape of the debt.
    return money(this.interestFor(loan, loan.currentBalance) + loan.currentBalance * 0.1);
  }

  // ---------------------------------------------------------- maintenance

  /**
   * Wipes loans and their occurrences and clears the shadow recurring
   * expenses the old loan code created. Confirmed transactions stay: those
   * are real money movements.
   */
  async resetAll(confirm: boolean) {
    const loans = await this.loanModel.find().select('name');
    const occurrences = await this.occurrenceModel.countDocuments();
    const legacy = await this.recurringExpensesService.purgeLegacyLoanPayments(confirm);

    const report = {
      loans: loans.map((loan) => ({ id: loan._id, name: loan.name })),
      loanOccurrences: occurrences,
      legacyRecurringExpenses: legacy,
      deleted: false,
      note: 'Transactions already confirmed are never deleted. Review those by hand if a loan payment was recorded twice.',
    };

    if (!confirm) {
      return { ...report, dryRun: true };
    }

    await this.occurrenceModel.deleteMany({});
    await this.loanModel.deleteMany({});

    return { ...report, deleted: true, dryRun: false };
  }

  // -------------------------------------------------------------- helpers

  private assertShape(loan: CreateLoanDto | LoanDocument) {
    if (loan.scheduleType === 'interval_days' && !loan.intervalDays) {
      throw new BadRequestException('An interval schedule needs the number of days between payments');
    }
    if (loan.scheduleType === 'monthly_days' && !(loan.daysOfMonth ?? []).length) {
      throw new BadRequestException('A monthly schedule needs at least one day of the month');
    }
    if (loan.kind === 'fixed_installment' && !loan.installmentAmount) {
      throw new BadRequestException('A fixed-instalment debt needs the amount due each period');
    }
    if (loan.kind === 'interest_bearing' && !loan.interestRatePercent) {
      throw new BadRequestException('An interest-bearing loan needs the rate charged per period');
    }
  }

  private interestFor(loan: LoanDocument, balance: number) {
    if (loan.kind !== 'interest_bearing') {
      return 0;
    }
    return money((balance * loan.interestRatePercent) / 100);
  }

  /**
   * The rule the user described: the interest for the period is covered
   * first, whatever is left reduces the capital, and interest left unpaid is
   * added to the balance so it earns interest in turn.
   */
  private splitPayment(loan: LoanDocument, balanceBefore: number, paidAmount: number) {
    if (loan.kind !== 'interest_bearing') {
      const principalPaid = Math.min(paidAmount, balanceBefore);
      return {
        interestDue: 0,
        interestPaid: 0,
        principalPaid: money(principalPaid),
        interestCapitalized: 0,
        balanceAfter: money(balanceBefore - principalPaid),
      };
    }

    const interestDue = this.interestFor(loan, balanceBefore);

    if (paidAmount >= interestDue) {
      const principalPaid = Math.min(money(paidAmount - interestDue), balanceBefore);
      return {
        interestDue,
        interestPaid: interestDue,
        principalPaid,
        interestCapitalized: 0,
        balanceAfter: money(balanceBefore - principalPaid),
      };
    }

    const interestCapitalized = money(interestDue - paidAmount);
    return {
      interestDue,
      interestPaid: paidAmount,
      principalPaid: 0,
      interestCapitalized,
      balanceAfter: money(balanceBefore + interestCapitalized),
    };
  }

  private transactionNote(
    loan: LoanDocument,
    split: { interestPaid: number; principalPaid: number; interestCapitalized: number },
    fx: {
      paidAmount: number;
      accountAmount: number;
      rate: number;
      debtCurrency: 'USD' | 'NIO';
      accountCurrency: 'USD' | 'NIO';
    },
  ) {
    const parts: string[] = [];

    if (loan.kind === 'interest_bearing') {
      parts.push(`interest ${split.interestPaid.toFixed(2)}`);
      parts.push(`principal ${split.principalPaid.toFixed(2)}`);
      if (split.interestCapitalized > 0) {
        parts.push(`capitalised ${split.interestCapitalized.toFixed(2)}`);
      }
    }

    if (fx.debtCurrency !== fx.accountCurrency) {
      parts.push(
        `${fx.debtCurrency} ${fx.paidAmount.toFixed(2)} settled as ${fx.accountCurrency} ${fx.accountAmount.toFixed(2)} at ${fx.rate}`,
      );
    }

    return [loan.notes, parts.join(' · ')].filter(Boolean).join(' — ');
  }

  /** Adds the paying account's currency view when the two differ. */
  private async decorateWithFx(loan: LoanDocument) {
    const base = this.decorate(loan);
    const accountId =
      typeof loan.accountId === 'object' && loan.accountId !== null && '_id' in (loan.accountId as any)
        ? (loan.accountId as any)._id.toString()
        : loan.accountId.toString();

    let accountCurrency: 'USD' | 'NIO' = loan.currency;
    const populated = loan.accountId as unknown as { currency?: 'USD' | 'NIO' };
    if (populated && typeof populated === 'object' && populated.currency) {
      accountCurrency = populated.currency;
    } else {
      const account = await this.accountsService.findById(accountId);
      accountCurrency = account.currency;
    }

    const settledPayments = await this.occurrenceModel.countDocuments({
      loanId: loan._id,
      status: { $in: ['confirmed', 'omitted'] },
    });

    const rate = await this.fxRate();
    const nextDue =
      loan.kind === 'interest_bearing' ? base.nextInterestDue : money(loan.installmentAmount);

    return {
      ...base,
      settledPayments,
      accountCurrency,
      exchangeRate: rate,
      crossCurrency: accountCurrency !== loan.currency,
      nextDueInAccountCurrency: this.convert(nextDue, loan.currency, accountCurrency, rate),
      balanceInAccountCurrency: this.convert(base.currentBalance, loan.currency, accountCurrency, rate),
    };
  }

  private decorate(loan: LoanDocument) {
    const plain = loan.toObject({ virtuals: true }) as Record<string, unknown>;
    const balance = money(loan.currentBalance);
    const remaining =
      loan.kind === 'fixed_installment' && loan.installmentAmount > 0
        ? Math.ceil(balance / loan.installmentAmount)
        : null;

    return {
      ...plain,
      currentBalance: balance,
      remainingInstallments: remaining,
      nextInterestDue: this.interestFor(loan, balance),
      progressPercent:
        loan.principal > 0 ? Math.min(100, Math.round(((loan.principal - balance) / loan.principal) * 100)) : 0,
    };
  }

  /** Settles the loan or makes sure the next payment exists. */
  private async afterBalanceChange(loan: LoanDocument) {
    if (loan.currentBalance <= 0 && loan.status === 'active') {
      loan.status = 'settled';
      loan.settledAt = new Date();
      loan.isActive = false;
      loan.currentBalance = 0;
      await loan.save();
      await this.occurrenceModel.deleteMany({ loanId: loan._id, status: 'planned' });
      return;
    }

    if (loan.status === 'active') {
      await this.ensurePlannedOccurrences(loan);
    }
  }

  private async rebuildSchedule(loan: LoanDocument) {
    await this.occurrenceModel.deleteMany({ loanId: loan._id, status: 'planned' });
    await this.ensurePlannedOccurrences(loan);
  }

  /**
   * A fixed-instalment debt gets its whole horizon generated. An
   * interest-bearing loan gets exactly one planned payment: the amount of
   * the next one depends on what is paid now.
   */
  private async ensurePlannedOccurrences(loan: LoanDocument) {
    if (!loan.isActive || loan.status !== 'active') {
      return;
    }

    const settledCount = await this.occurrenceModel.countDocuments({
      loanId: loan._id,
      status: { $in: ['confirmed', 'omitted'] },
    });

    if (loan.kind === 'interest_bearing') {
      const planned = await this.occurrenceModel.countDocuments({
        loanId: loan._id,
        status: 'planned',
      });
      if (planned > 0) {
        return;
      }
      const last = await this.occurrenceModel.findOne({ loanId: loan._id }).sort({ date: -1 });
      const date = last ? this.nextDateAfter(loan, last.date) : this.firstDate(loan);
      await this.occurrenceModel.create({
        loanId: loan._id,
        accountId: loan.accountId,
        categoryId: loan.categoryId,
        date,
        amount: this.interestFor(loan, loan.currentBalance),
        interestDue: this.interestFor(loan, loan.currentBalance),
        balanceBefore: money(loan.currentBalance),
        currency: loan.currency,
        status: 'planned',
        sequence: settledCount + 1,
      });
      return;
    }

    // fixed_installment — generate the horizon in one go.
    const remainingByBalance =
      loan.installmentAmount > 0 ? Math.ceil(loan.currentBalance / loan.installmentAmount) : 0;
    const cap = Math.min(
      loan.totalInstallments ? loan.totalInstallments - settledCount : remainingByBalance,
      remainingByBalance,
      this.maxScheduledPeriods,
    );
    if (cap <= 0) {
      return;
    }

    const existing = await this.occurrenceModel
      .find({ loanId: loan._id, status: 'planned' })
      .sort({ date: 1 });
    const known = new Set(existing.map((item) => item.date.toISOString().slice(0, 10)));

    const last = await this.occurrenceModel.findOne({ loanId: loan._id }).sort({ date: -1 });
    let date = last ? this.nextDateAfter(loan, last.date) : this.firstDate(loan);
    const horizon = new Date();
    horizon.setMonth(horizon.getMonth() + this.monthsAhead);

    for (let index = existing.length; index < cap; index += 1) {
      if (date > horizon && index > 0) {
        break;
      }
      const key = date.toISOString().slice(0, 10);
      if (!known.has(key)) {
        await this.occurrenceModel.create({
          loanId: loan._id,
          accountId: loan.accountId,
          categoryId: loan.categoryId,
          date: new Date(date),
          amount: loan.installmentAmount,
          balanceBefore: 0,
          currency: loan.currency,
          status: 'planned',
          sequence: settledCount + index + 1,
        });
      }
      date = this.nextDateAfter(loan, date);
    }
  }

  private firstDate(loan: LoanDocument): Date {
    const start = loan.startDate ? new Date(loan.startDate) : new Date();
    if (loan.scheduleType === 'interval_days') {
      return start;
    }
    // monthly_days: the first configured day on or after the start date
    const days = [...(loan.daysOfMonth ?? [])].sort((a, b) => a - b);
    const candidate = days
      .map((day) => this.dayInMonth(start.getFullYear(), start.getMonth(), day))
      .find((date) => date >= this.atMidnight(start));
    return candidate ?? this.dayInMonth(start.getFullYear(), start.getMonth() + 1, days[0] ?? 1);
  }

  private nextDateAfter(loan: LoanDocument, reference: Date): Date {
    if (loan.scheduleType === 'interval_days') {
      const next = new Date(reference);
      next.setDate(next.getDate() + (loan.intervalDays ?? 30));
      return next;
    }

    const days = [...(loan.daysOfMonth ?? [1])].sort((a, b) => a - b);
    const ref = this.atMidnight(reference);

    for (const day of days) {
      const candidate = this.dayInMonth(ref.getFullYear(), ref.getMonth(), day);
      if (candidate > ref) {
        return candidate;
      }
    }
    return this.dayInMonth(ref.getFullYear(), ref.getMonth() + 1, days[0]);
  }

  /** Clamps to the end of short months: day 30 in February lands on the 28th/29th. */
  private dayInMonth(year: number, monthIndex: number, day: number): Date {
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    return new Date(year, monthIndex, Math.min(Math.max(day, 1), daysInMonth));
  }

  private atMidnight(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
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

    return {
      start: new Date(year, monthIndex, 1),
      end: new Date(year, monthIndex + 1, 0, 23, 59, 59, 999),
      year,
      monthIndex,
    };
  }
}
