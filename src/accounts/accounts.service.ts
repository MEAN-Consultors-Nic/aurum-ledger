import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAccountDto } from './dto/create-account.dto';
import { FilterAccountDto } from './dto/filter-account.dto';
import { ResetAccountDto } from './dto/reset-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { Account, AccountDocument } from './schemas/account.schema';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';

@Injectable()
export class AccountsService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async create(dto: CreateAccountDto, userId?: Types.ObjectId) {
    return this.accountModel.create({
      ...dto,
      initialBalance: dto.initialBalance ?? 0,
      isActive: dto.isActive ?? true,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async findAll(filter: FilterAccountDto) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.isActive === 'true') {
      query.isActive = true;
    }
    if (filter.isActive === 'false') {
      query.isActive = false;
    }
    const accounts = await this.accountModel.find(query).sort({ createdAt: -1 });
    if (filter.includeBalance !== 'true') {
      return accounts;
    }

    const accountIds = accounts.map((account) => account._id);
    const totals = await this.transactionModel.aggregate([
      { $match: { accountId: { $in: accountIds }, voidedAt: { $exists: false } } },
      {
        $group: {
          _id: '$accountId',
          total: {
            $sum: {
              $cond: [{ $eq: ['$flow', 'in'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]);
    const totalsMap = new Map(
      totals.map((item) => [item._id.toString(), Number(item.total || 0)]),
    );

    return accounts.map((account) => ({
      ...account.toObject(),
      currentBalance: account.initialBalance + (totalsMap.get(account._id.toString()) ?? 0),
    }));
  }

  async findById(id: string) {
    const account = await this.accountModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async update(id: string, dto: UpdateAccountDto, userId?: Types.ObjectId) {
    const account = await this.accountModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { ...dto, updatedBy: userId },
      { new: true },
    );
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  async resetBalance(id: string, dto: ResetAccountDto, userId?: Types.ObjectId) {
    const account = await this.accountModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const currentBalance = await this.getCurrentBalance(account);
    const desiredBalance = dto.currentBalance;
    const delta = desiredBalance - currentBalance;
    if (delta === 0) {
      throw new BadRequestException('Balance already matches current balance');
    }

    const flow = delta > 0 ? 'in' : 'out';
    const amount = Math.abs(delta);

    return this.transactionModel.create({
      type: 'adjustment',
      flow,
      accountId: account._id,
      amount,
      currency: account.currency,
      date: new Date(),
      reference: 'Balance reset',
      notes: dto.note,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const account = await this.accountModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!account) {
      throw new NotFoundException('Account not found');
    }
    return account;
  }

  private async getCurrentBalance(account: AccountDocument) {
    const totals = await this.transactionModel.aggregate([
      { $match: { accountId: account._id, voidedAt: { $exists: false } } },
      {
        $group: {
          _id: '$accountId',
          total: {
            $sum: {
              $cond: [{ $eq: ['$flow', 'in'] }, '$amount', { $multiply: ['$amount', -1] }],
            },
          },
        },
      },
    ]);

    const total = totals.length > 0 ? Number(totals[0].total || 0) : 0;
    return account.initialBalance + total;
  }
}
