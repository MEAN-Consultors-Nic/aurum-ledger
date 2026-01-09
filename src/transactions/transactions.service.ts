import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AccountsService } from '../accounts/accounts.service';
import { CreateTransactionDto } from './dto/create-transaction.dto';
import { CreateTransferDto } from './dto/create-transfer.dto';
import { FilterTransactionDto } from './dto/filter-transaction.dto';
import { Transaction, TransactionDocument } from './schemas/transaction.schema';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    private readonly accountsService: AccountsService,
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
    const query: Record<string, unknown> = {};
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

    return this.transactionModel
      .find(query)
      .sort({ date: -1 })
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

  async removeByPaymentId(paymentId: Types.ObjectId) {
    await this.transactionModel.deleteMany({ linkedPaymentId: paymentId });
  }
}
