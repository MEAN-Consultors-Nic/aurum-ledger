import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateAssetDto } from './dto/create-asset.dto';
import { UpdateAssetDto } from './dto/update-asset.dto';
import { Asset, AssetDocument } from './schemas/asset.schema';

@Injectable()
export class AssetsService {
  constructor(
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
  ) {}

  async list() {
    return this.assetModel
      .find({ deletedAt: { $exists: false } })
      .sort({ type: 1, name: 1 });
  }

  async findById(id: string) {
    const asset = await this.assetModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async create(dto: CreateAssetDto, userId?: Types.ObjectId) {
    return this.assetModel.create({
      ...dto,
      lastValuationAt: new Date(),
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async update(id: string, dto: UpdateAssetDto, userId?: Types.ObjectId) {
    const updates: Record<string, unknown> = { ...dto, updatedBy: userId };
    if (dto.currentValue !== undefined) {
      updates.lastValuationAt = new Date();
    }
    const asset = await this.assetModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      updates,
      { new: true },
    );
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }

  async remove(id: string, userId?: Types.ObjectId) {
    const asset = await this.assetModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!asset) throw new NotFoundException('Asset not found');
    return asset;
  }
}
