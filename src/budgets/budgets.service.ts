import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { FilterBudgetDto } from './dto/filter-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { Budget, BudgetDocument } from './schemas/budget.schema';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private readonly budgetModel: Model<BudgetDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async create(dto: CreateBudgetDto, userId?: Types.ObjectId) {
    return this.budgetModel.create({
      ...dto,
      categoryId: new Types.ObjectId(dto.categoryId),
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async findAll(filter: FilterBudgetDto) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.month) {
      query.month = Number(filter.month);
    }
    if (filter.year) {
      query.year = Number(filter.year);
    }
    return this.budgetModel.find(query).populate('categoryId', 'name type');
  }

  async update(id: string, dto: UpdateBudgetDto, userId?: Types.ObjectId) {
    const payload: Record<string, unknown> = {
      ...dto,
      updatedBy: userId,
    };
    if (dto.categoryId) {
      payload.categoryId = new Types.ObjectId(dto.categoryId);
    }
    const budget = await this.budgetModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      payload,
      { new: true },
    );
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    return budget;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const budget = await this.budgetModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!budget) {
      throw new NotFoundException('Budget not found');
    }
    return budget;
  }

  async getAlerts(params?: { month?: number; year?: number; threshold?: number }) {
    const now = new Date();
    const month = params?.month ?? now.getMonth() + 1;
    const year = params?.year ?? now.getFullYear();
    const threshold = params?.threshold ?? 0.8;

    const budgets = await this.budgetModel
      .find({ month, year, deletedAt: { $exists: false } })
      .populate('categoryId', 'name type');

    if (budgets.length === 0) {
      return { count: 0, items: [] };
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const categoryIds = budgets.map((budget) => {
      const category = budget.categoryId as { _id?: Types.ObjectId } | Types.ObjectId;
      return (category as { _id?: Types.ObjectId })._id ?? (category as Types.ObjectId);
    });
    const expenses = await this.transactionModel.aggregate([
      {
        $match: {
          type: 'expense',
          categoryId: { $in: categoryIds },
          date: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: { categoryId: '$categoryId', currency: '$currency' },
          total: { $sum: '$amount' },
        },
      },
    ]);

    const totals = new Map<string, number>();
    for (const item of expenses) {
      const key = `${item._id.categoryId.toString()}-${item._id.currency}`;
      totals.set(key, item.total);
    }

    const items = budgets
      .map((budget) => {
        const category = budget.categoryId as { _id: Types.ObjectId; name: string } | Types.ObjectId;
        const categoryId = (category as { _id?: Types.ObjectId })._id ?? (category as Types.ObjectId);
        const key = `${categoryId.toString()}-${budget.currency}`;
        const spent = totals.get(key) ?? 0;
        const usage = budget.amount > 0 ? spent / budget.amount : 0;
        return {
          budgetId: budget._id.toString(),
          categoryId: categoryId.toString(),
          categoryName: (category as { name?: string }).name ?? categoryId.toString(),
          month,
          year,
          currency: budget.currency,
          amount: budget.amount,
          spent,
          usage,
        };
      })
      .filter((item) => item.usage >= threshold);

    return { count: items.length, items };
  }
}
