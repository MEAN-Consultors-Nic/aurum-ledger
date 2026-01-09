import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateBudgetDto } from './dto/create-budget.dto';
import { FilterBudgetDto } from './dto/filter-budget.dto';
import { UpdateBudgetDto } from './dto/update-budget.dto';
import { Budget, BudgetDocument } from './schemas/budget.schema';

@Injectable()
export class BudgetsService {
  constructor(
    @InjectModel(Budget.name) private readonly budgetModel: Model<BudgetDocument>,
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
}
