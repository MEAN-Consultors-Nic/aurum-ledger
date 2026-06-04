import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../accounts/schemas/account.schema';
import { Budget, BudgetDocument } from '../budgets/schemas/budget.schema';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';

@Injectable()
export class FinanceService {
  constructor(
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Budget.name) private readonly budgetModel: Model<BudgetDocument>,
  ) {}

  async overview() {
    const [accountTotals, txTotals] = await Promise.all([
      this.accountModel.aggregate([
        { $match: { deletedAt: { $exists: false } } },
        { $group: { _id: '$currency', total: { $sum: '$initialBalance' } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { voidedAt: { $exists: false } } },
        {
          $group: {
            _id: '$currency',
            total: {
              $sum: {
                $cond: [{ $eq: ['$flow', 'in'] }, '$amount', { $multiply: ['$amount', -1] }],
              },
            },
          },
        },
      ]),
    ]);

    const totals = {
      USD: 0,
      NIO: 0,
    };
    accountTotals.forEach((item) => {
      totals[item._id as 'USD' | 'NIO'] += item.total || 0;
    });
    txTotals.forEach((item) => {
      totals[item._id as 'USD' | 'NIO'] += item.total || 0;
    });

    return {
      balanceUsd: totals.USD,
      balanceNio: totals.NIO,
    };
  }

  async byCategory(month?: number, year?: number) {
    const match: Record<string, unknown> = { type: 'expense', voidedAt: { $exists: false } };
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 1);
      match.date = { $gte: start, $lt: end };
    }

    const expenses = await this.transactionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { categoryId: '$categoryId', currency: '$currency' },
          total: { $sum: '$amount' },
        },
      },
    ]);

    const categoryIds = expenses
      .map((item) => item._id.categoryId)
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));
    const categories = await this.categoryModel.find({ _id: { $in: categoryIds } });
    const budgets = await this.budgetModel.find(
      month && year ? { month, year, categoryId: { $in: categoryIds } } : { categoryId: { $in: categoryIds } },
    );

    return expenses.map((item) => {
      const category = categories.find((cat) => cat._id.toString() === String(item._id.categoryId));
      const budget = budgets.find(
        (b) => b.categoryId.toString() === String(item._id.categoryId) && b.currency === item._id.currency,
      );
      return {
        categoryId: item._id.categoryId,
        categoryName: category?.name ?? 'Sin categoria',
        currency: item._id.currency,
        total: item.total,
        budget: budget?.amount ?? 0,
      };
    });
  }

  async byClient(from?: string, to?: string) {
    const match: Record<string, unknown> = {
      type: 'income',
      linkedClientId: { $exists: true },
      voidedAt: { $exists: false },
    };
    if (from || to) {
      match.date = {};
      if (from) {
        (match.date as Record<string, Date>).$gte = new Date(from);
      }
      if (to) {
        (match.date as Record<string, Date>).$lte = new Date(to);
      }
    }

    return this.transactionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { clientId: '$linkedClientId', currency: '$currency' },
          total: { $sum: '$amount' },
        },
      },
      {
        $lookup: {
          from: 'clients',
          localField: '_id.clientId',
          foreignField: '_id',
          as: 'client',
        },
      },
      { $unwind: { path: '$client', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          clientId: '$_id.clientId',
          clientName: '$client.name',
          currency: '$_id.currency',
          total: 1,
        },
      },
    ]);
  }

  async byContract(from?: string, to?: string) {
    const match: Record<string, unknown> = {
      type: 'income',
      linkedContractId: { $exists: true },
      voidedAt: { $exists: false },
    };
    if (from || to) {
      match.date = {};
      if (from) {
        (match.date as Record<string, Date>).$gte = new Date(from);
      }
      if (to) {
        (match.date as Record<string, Date>).$lte = new Date(to);
      }
    }

    return this.transactionModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { contractId: '$linkedContractId', currency: '$currency' },
          total: { $sum: '$amount' },
        },
      },
      {
        $lookup: {
          from: 'contracts',
          localField: '_id.contractId',
          foreignField: '_id',
          as: 'contract',
        },
      },
      { $unwind: { path: '$contract', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          contractId: '$_id.contractId',
          contractTitle: '$contract.title',
          currency: '$_id.currency',
          total: 1,
        },
      },
    ]);
  }
}
