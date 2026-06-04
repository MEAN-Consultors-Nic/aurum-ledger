import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ContractsService } from '../contracts/contracts.service';
import { SettingsService } from '../settings/settings.service';
import { TransactionsService } from '../transactions/transactions.service';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { FilterPaymentDto } from './dto/filter-payment.dto';
import { Payment, PaymentDocument } from './schemas/payment.schema';

@Injectable()
export class PaymentsService {
  constructor(
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly contractsService: ContractsService,
    private readonly config: ConfigService,
    private readonly transactionsService: TransactionsService,
    private readonly settingsService: SettingsService,
  ) {}

  async create(dto: CreatePaymentDto, userId?: Types.ObjectId) {
    if (dto.method === 'bank' && !dto.accountId) {
      throw new BadRequestException('Account is required for bank payments');
    }
    if (!dto.accountId) {
      throw new BadRequestException('Account is required for this payment method');
    }
    const contract = await this.contractsService.getContractById(dto.contractId);
    const currency = dto.currency ?? 'USD';
    const exchangeRate = dto.exchangeRate ?? (await this.getFxRate());
    const paymentTotal = dto.amount + (dto.retentionAmount ?? 0);
    const appliedAmount = this.convertToContractCurrency(
      paymentTotal,
      currency,
      contract.currency ?? 'USD',
      exchangeRate,
    );

    const payment = await this.paymentModel.create({
      ...dto,
      contractId: new Types.ObjectId(dto.contractId),
      clientId: new Types.ObjectId(dto.clientId),
      accountId: new Types.ObjectId(dto.accountId),
      paymentDate: new Date(dto.paymentDate),
      retentionAmount: dto.retentionAmount ?? 0,
      currency,
      exchangeRate,
      appliedAmount,
      createdBy: userId,
    });

    const defaultCategoryId = await this.settingsService.getDefaultPaymentCategoryId();
    await this.transactionsService.createFromPayment({
      paymentId: payment._id,
      accountId: new Types.ObjectId(dto.accountId),
      amount: Number(dto.amount ?? 0),
      currency,
      exchangeRate,
      clientId: new Types.ObjectId(dto.clientId),
      contractId: new Types.ObjectId(dto.contractId),
      date: new Date(dto.paymentDate),
      reference: dto.reference,
      notes: dto.notes,
      categoryId: defaultCategoryId ? new Types.ObjectId(defaultCategoryId) : undefined,
      userId,
    });

    await this.recalculateContract(dto.contractId);

    return payment;
  }

  async findAll(filter: FilterPaymentDto) {
    const page = Math.max(Number(filter.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
    const query: Record<string, unknown> = { voidedAt: { $exists: false } };

    if (filter.clientId) {
      query.clientId = new Types.ObjectId(filter.clientId);
    }

    if (filter.contractId) {
      query.contractId = new Types.ObjectId(filter.contractId);
    }

    if (filter.accountId) {
      query.accountId = new Types.ObjectId(filter.accountId);
    }

    if (filter.from || filter.to) {
      query.paymentDate = {} as Record<string, Date>;
      if (filter.from) {
        (query.paymentDate as Record<string, Date>).$gte = new Date(filter.from);
      }
      if (filter.to) {
        (query.paymentDate as Record<string, Date>).$lte = new Date(filter.to);
      }
    }

    const [items, total] = await Promise.all([
      this.paymentModel
        .find(query)
        .populate('clientId', 'name')
        .populate('contractId', 'title')
        .sort({ paymentDate: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.paymentModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const payment = await this.paymentModel
      .findOne({ _id: id, voidedAt: { $exists: false } })
      .populate('clientId', 'name')
      .populate('contractId', 'title');
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  async remove(id: string) {
    const payment = await this.paymentModel.findByIdAndDelete(id);
    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    await this.transactionsService.removeByPaymentId(payment._id);
    await this.recalculateContract(payment.contractId.toString());

    return { success: true };
  }

  private async recalculateContract(contractId: string) {
    const contractObjectId = new Types.ObjectId(contractId);
    const result = await this.paymentModel.aggregate([
      { $match: { contractId: contractObjectId, voidedAt: { $exists: false } } },
      {
        $group: {
          _id: '$contractId',
          paidTotal: {
            $sum: {
              $ifNull: [
                '$appliedAmount',
                { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
              ],
            },
          },
          paymentCount: { $sum: 1 },
          lastPaymentDate: { $max: '$paymentDate' },
        },
      },
    ]);

    if (result.length === 0) {
      await this.contractsService.updateFinancials(
        contractObjectId,
        0,
        0,
        undefined,
      );
      return;
    }

    const aggregate = result[0];
    await this.contractsService.updateFinancials(
      contractObjectId,
      aggregate.paidTotal,
      aggregate.paymentCount,
      aggregate.lastPaymentDate,
    );
  }

  private convertToContractCurrency(
    amount: number,
    paymentCurrency: 'USD' | 'NIO',
    contractCurrency: 'USD' | 'NIO',
    exchangeRate: number,
  ) {
    if (paymentCurrency === contractCurrency) {
      return amount;
    }

    if (contractCurrency === 'USD') {
      return amount / exchangeRate;
    }

    return amount * exchangeRate;
  }

  private async getFxRate() {
    const fromSettings = await this.settingsService.getNumber('fxUsdToNio');
    if (fromSettings && fromSettings > 0) {
      return fromSettings;
    }
    const raw = this.config.get<string>('FX_USD_TO_NIO') ?? '36';
    const rate = Number(raw);
    return Number.isFinite(rate) && rate > 0 ? rate : 36;
  }
}
