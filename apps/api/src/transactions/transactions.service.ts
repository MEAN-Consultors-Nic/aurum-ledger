import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { ContractsService } from '../contracts/contracts.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly accountsService: AccountsService,
    private readonly contractsService: ContractsService,
  ) {}

  async create(dto: CreateTransactionDto, userId?: Types.ObjectId) {
    const account = await this.accountsService.findById(dto.accountId);
    if (account.currency !== dto.currency) {
      throw new BadRequestException('Transaction currency must match account currency');
    }

    let flow: 'in' | 'out' = 'in';
    if (dto.type === 'income') {
      flow = 'in';
      if (!dto.categoryId) {
        throw new BadRequestException('categoryId is required for income');
      }
    }
    if (dto.type === 'expense') {
      flow = 'out';
      if (!dto.categoryId) {
        throw new BadRequestException('categoryId is required for expense');
      }
    }
    if (dto.type === 'adjustment') {
      if (!dto.flow) {
        throw new BadRequestException('flow is required for adjustment');
      }
      flow = dto.flow;
    }

    return this.transactionModel.create({
      type: dto.type,
      flow,
      accountId: new Types.ObjectId(dto.accountId),
      categoryId: dto.categoryId ? new Types.ObjectId(dto.categoryId) : undefined,
      amount: dto.amount,
      currency: dto.currency,
      exchangeRate: dto.exchangeRate,
      date: new Date(dto.date),
      reference: dto.reference,
      notes: dto.notes,
      linkedClientId: dto.linkedClientId ? new Types.ObjectId(dto.linkedClientId) : undefined,
      linkedContractId: dto.linkedContractId ? new Types.ObjectId(dto.linkedContractId) : undefined,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async createTransfer(dto: CreateTransferDto, userId?: Types.ObjectId) {
    if (dto.fromAccountId === dto.toAccountId) {
      throw new BadRequestException('Transfer accounts must be different');
    }

    const fromAccount = await this.accountsService.findById(dto.fromAccountId);
    const toAccount = await this.accountsService.findById(dto.toAccountId);

    if (fromAccount.currency !== dto.currency) {
      throw new BadRequestException('Transfer currency must match origin account currency');
    }

    const exchangeRate = dto.exchangeRate;
    let toAmount = dto.amount;
    if (fromAccount.currency !== toAccount.currency) {
      if (!exchangeRate || exchangeRate <= 0) {
        throw new BadRequestException('exchangeRate is required for cross-currency transfer');
      }
      if (fromAccount.currency === 'USD' && toAccount.currency === 'NIO') {
        toAmount = dto.amount * exchangeRate;
      } else if (fromAccount.currency === 'NIO' && toAccount.currency === 'USD') {
        toAmount = dto.amount / exchangeRate;
      }
    }

    const date = new Date(dto.date);
    const transferGroupId = new Types.ObjectId();
    const outTx = await this.transactionModel.create({
      type: 'transfer',
      flow: 'out',
      accountId: new Types.ObjectId(dto.fromAccountId),
      toAccountId: new Types.ObjectId(dto.toAccountId),
      amount: dto.amount,
      currency: fromAccount.currency,
      exchangeRate,
      date,
      reference: dto.reference,
      notes: dto.notes,
      transferGroupId,
      createdBy: userId,
      updatedBy: userId,
    });

    const inTx = await this.transactionModel.create({
      type: 'transfer',
      flow: 'in',
      accountId: new Types.ObjectId(dto.toAccountId),
      toAccountId: new Types.ObjectId(dto.fromAccountId),
      amount: toAmount,
      currency: toAccount.currency,
      exchangeRate,
      date,
      reference: dto.reference,
      notes: dto.notes,
      transferGroupId,
      createdBy: userId,
      updatedBy: userId,
    });

    return { out: outTx, in: inTx };
  }

  async createFromPayment(params: {
    paymentId: Types.ObjectId;
    accountId: Types.ObjectId;
    amount: number;
    currency: 'USD' | 'NIO';
    exchangeRate?: number;
    clientId: Types.ObjectId;
    contractId: Types.ObjectId;
    date: Date;
    reference?: string;
    notes?: string;
    categoryId?: Types.ObjectId;
    userId?: Types.ObjectId;
  }) {
    const account = await this.accountsService.findById(params.accountId.toString());
    const rate = params.exchangeRate && params.exchangeRate > 0 ? params.exchangeRate : 1;
    let accountAmount = params.amount;
    if (params.currency !== account.currency) {
      if (params.currency === 'USD' && account.currency === 'NIO') {
        accountAmount = params.amount * rate;
      } else if (params.currency === 'NIO' && account.currency === 'USD') {
        accountAmount = params.amount / rate;
      } else {
        throw new BadRequestException('Unsupported currency conversion');
      }
    }

    return this.transactionModel.create({
      type: 'income',
      flow: 'in',
      accountId: new Types.ObjectId(params.accountId),
      amount: accountAmount,
      currency: account.currency,
      exchangeRate: params.exchangeRate,
      date: params.date,
      reference: params.reference,
      notes: params.notes,
      categoryId: params.categoryId,
      linkedPaymentId: params.paymentId,
      linkedClientId: params.clientId,
      linkedContractId: params.contractId,
      createdBy: params.userId,
      updatedBy: params.userId,
    });
  }

  async findAll(filter: FilterTransactionDto) {
    const query: Record<string, unknown> = { voidedAt: { $exists: false } };
    if (filter.accountId) {
      query.accountId = new Types.ObjectId(filter.accountId);
    }
    if (filter.type) {
      query.type = filter.type;
    }
    if (filter.categoryId) {
      query.categoryId = new Types.ObjectId(filter.categoryId);
    }
    if (filter.clientId) {
      query.linkedClientId = new Types.ObjectId(filter.clientId);
    }
    if (filter.contractId) {
      query.linkedContractId = new Types.ObjectId(filter.contractId);
    }
    if (filter.from || filter.to) {
      query.date = {};
      if (filter.from) {
        (query.date as Record<string, Date>).$gte = new Date(filter.from);
      }
      if (filter.to) {
        (query.date as Record<string, Date>).$lte = new Date(filter.to);
      }
    }

    const sortField = filter.sortField ?? 'date';
    const sortDirection = filter.sortDirection === 'asc' ? 1 : -1;
    const sort: Record<string, SortOrder> = { [sortField]: sortDirection };

    return this.transactionModel
      .find(query)
      .sort(sort)
      .populate('accountId', 'name currency')
      .populate('categoryId', 'name type')
      .populate('linkedClientId', 'name')
      .populate('linkedContractId', 'title');
  }

  async findById(id: string) {
    const tx = await this.transactionModel.findById(id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    return tx;
  }

  async void(id: string, userId?: Types.ObjectId) {
    const tx = await this.transactionModel.findById(id);
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    if (tx.voidedAt) {
      throw new BadRequestException('Transaction already voided');
    }

    const voidedAt = new Date();
    if (tx.transferGroupId) {
      await this.transactionModel.updateMany(
        { transferGroupId: tx.transferGroupId, voidedAt: { $exists: false } },
        { voidedAt, voidedBy: userId },
      );
    } else if (tx.type === 'transfer' && tx.toAccountId) {
      await this.transactionModel.updateMany(
        {
          type: 'transfer',
          accountId: tx.accountId,
          toAccountId: tx.toAccountId,
          date: tx.date,
          voidedAt: { $exists: false },
        },
        { voidedAt, voidedBy: userId },
      );
      await this.transactionModel.updateMany(
        {
          type: 'transfer',
          accountId: tx.toAccountId,
          toAccountId: tx.accountId,
          date: tx.date,
          voidedAt: { $exists: false },
        },
        { voidedAt, voidedBy: userId },
      );
    } else {
      await this.transactionModel.findByIdAndUpdate(id, {
        voidedAt,
        voidedBy: userId,
      });
    }

    if (tx.linkedPaymentId) {
      await this.paymentModel.findByIdAndUpdate(tx.linkedPaymentId, {
        voidedAt,
        voidedBy: userId,
      });
    }

    if (tx.linkedContractId) {
      await this.recalculateContract(tx.linkedContractId.toString());
    }

    return { success: true };
  }

  async removeByPaymentId(paymentId: Types.ObjectId) {
    await this.transactionModel.deleteMany({ linkedPaymentId: paymentId });
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
}
