import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCategoryDto } from './dto/create-category.dto';
import { FilterCategoryDto } from './dto/filter-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { Category, CategoryDocument } from './schemas/category.schema';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async create(dto: CreateCategoryDto, userId?: Types.ObjectId) {
    return this.categoryModel.create({
      ...dto,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : undefined,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async findAll(filter: FilterCategoryDto) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.type) {
      query.type = filter.type;
    }
    return this.categoryModel.find(query).sort({ createdAt: -1 });
  }

  async findById(id: string) {
    const category = await this.categoryModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, userId?: Types.ObjectId) {
    const category = await this.categoryModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      {
        ...dto,
        parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : undefined,
        updatedBy: userId,
      },
      { new: true },
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const category = await this.categoryModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }
}
