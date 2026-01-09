import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../categories/schemas/category.schema';
import { Setting, SettingDocument } from './schemas/setting.schema';

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(Setting.name) private readonly settingModel: Model<SettingDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async getAll() {
    return this.settingModel.find().sort({ key: 1 });
  }

  async getValue(key: string) {
    const setting = await this.settingModel.findOne({ key });
    return setting?.value ?? null;
  }

  async setValue(key: string, value: string, userId?: string) {
    return this.settingModel.findOneAndUpdate(
      { key },
      { key, value, updatedBy: userId },
      { upsert: true, new: true },
    );
  }

  async getNumber(key: string) {
    const value = await this.getValue(key);
    if (value === null || value === undefined) {
      return null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  }

  async getDefaultPaymentCategoryId() {
    const configured = await this.getValue('defaultPaymentCategoryId');
    if (configured) {
      return configured;
    }

    const fallback = await this.categoryModel.findOne({ name: 'Work', type: 'income' });
    return fallback?._id?.toString() ?? null;
  }
}
