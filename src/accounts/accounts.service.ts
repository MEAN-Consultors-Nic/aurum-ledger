import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAccountDto } from './dto/create-account.dto';
import { FilterAccountDto } from './dto/filter-account.dto';
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
      { $match: { accountId: { $in: accountIds } } },
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
}
