import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateServiceDto } from './dto/create-service.dto';
import { UpdateServiceDto } from './dto/update-service.dto';
import { Service, ServiceDocument } from './schemas/service.schema';

@Injectable()
export class ServicesService {
  constructor(
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
  ) {}

  async create(dto: CreateServiceDto) {
    return this.serviceModel.create({ ...dto, isActive: true });
  }

  async findAll() {
    return this.serviceModel
      .find({ deletedAt: { $exists: false } })
      .sort({ createdAt: -1 });
  }

  async update(id: string, dto: UpdateServiceDto) {
    const service = await this.serviceModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      dto,
      { new: true },
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }

  async softDelete(id: string) {
    const service = await this.serviceModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!service) {
      throw new NotFoundException('Service not found');
    }
    return service;
  }
}
