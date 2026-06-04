import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { ContractsService } from '../contracts/contracts.service';
import { ConvertEstimateDto } from './dto/convert-estimate.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { FilterEstimateDto } from './dto/filter-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { Estimate, EstimateDocument } from './schemas/estimate.schema';

@Injectable()
export class EstimatesService {
  constructor(
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
    private readonly contractsService: ContractsService,
  ) {}

  async create(dto: CreateEstimateDto, userId?: Types.ObjectId) {
    return this.estimateModel.create({
      ...dto,
      clientId: new Types.ObjectId(dto.clientId),
      serviceId: new Types.ObjectId(dto.serviceId),
      currency: dto.currency ?? 'USD',
      status: dto.status ?? 'draft',
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async findAll(filter: FilterEstimateDto) {
    const page = Math.max(Number(filter.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };

    if (filter.clientId) {
      query.clientId = new Types.ObjectId(filter.clientId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.search) {
      query.$or = [{ title: { $regex: filter.search, $options: 'i' } }];
    }

    const sort: Record<string, SortOrder> = { createdAt: -1 };

    const [items, total] = await Promise.all([
      this.estimateModel
        .find(query)
        .populate('clientId', 'name')
        .populate('serviceId', 'name')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      this.estimateModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    })
      .populate('clientId', 'name')
      .populate('serviceId', 'name');

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    return estimate;
  }

  async update(id: string, dto: UpdateEstimateDto, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (estimate.status === 'converted') {
      throw new BadRequestException('Converted estimates cannot be updated');
    }

    const { clientId, serviceId, validUntil, ...restDto } = dto;
    const payload: Partial<Estimate> = {
      ...restDto,
      updatedBy: userId,
    };

    if (clientId) {
      payload.clientId = new Types.ObjectId(clientId);
    }
    if (serviceId) {
      payload.serviceId = new Types.ObjectId(serviceId);
    }
    if (validUntil !== undefined) {
      payload.validUntil = validUntil ? new Date(validUntil) : undefined;
    }

    const updated = await this.estimateModel.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) {
      throw new NotFoundException('Estimate not found');
    }
    return updated;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const existing = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!existing) {
      throw new NotFoundException('Estimate not found');
    }
    if (existing.status === 'converted') {
      throw new BadRequestException(
        'Converted estimates cannot be deleted because they are linked to an existing contract',
      );
    }
    existing.deletedAt = new Date();
    existing.updatedBy = userId;
    await existing.save();
    return existing;
  }

  async convertToContract(id: string, dto: ConvertEstimateDto, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (estimate.status === 'converted') {
      throw new BadRequestException('Estimate is already converted');
    }
    if (estimate.status === 'rejected' || estimate.status === 'expired') {
      throw new BadRequestException('Estimate cannot be converted from current status');
    }

    const contractNotesBase = dto.contractNotes ?? estimate.notes;
    const contractNotes = dto.conversionNotes
      ? [contractNotesBase, `Conversion: ${dto.conversionNotes}`].filter(Boolean).join('\n')
      : contractNotesBase;

    const contract = await this.contractsService.create(
      {
        clientId: estimate.clientId.toString(),
        serviceId: estimate.serviceId.toString(),
        title: estimate.title,
        billingPeriod: dto.billingPeriod ?? estimate.billingPeriod,
        amount: dto.amount ?? estimate.amount,
        currency: dto.currency ?? estimate.currency ?? 'USD',
        startDate: dto.startDate,
        endDate: dto.endDate,
        notes: contractNotes,
        createProject: dto.createProject,
        createGithubRepo: dto.createGithubRepo,
      },
      userId,
    );

    const updatedEstimate = await this.estimateModel.findByIdAndUpdate(
      estimate._id,
      {
        status: 'converted',
        convertedAt: new Date(),
        convertedBy: userId,
        convertedContractId: contract._id,
        conversionNotes: dto.conversionNotes,
        updatedBy: userId,
      },
      { new: true },
    );

    if (!updatedEstimate) {
      throw new NotFoundException('Estimate not found');
    }

    return { estimate: updatedEstimate, contract };
  }

  // ------------------------------------------------------------
  // Client-portal share link
  // ------------------------------------------------------------

  async generateShareToken(id: string, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    estimate.shareToken = randomBytes(32).toString('base64url');
    estimate.shareCreatedAt = new Date();
    estimate.shareCreatedBy = userId;
    estimate.shareRevokedAt = undefined;
    estimate.shareViewCount = 0;
    estimate.shareLastViewedAt = undefined;
    estimate.updatedBy = userId;
    await estimate.save();
    return {
      shareToken: estimate.shareToken,
      shareCreatedAt: estimate.shareCreatedAt,
      shareRevokedAt: estimate.shareRevokedAt,
      shareViewCount: estimate.shareViewCount,
      shareLastViewedAt: estimate.shareLastViewedAt,
    };
  }

  async revokeShareToken(id: string, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    estimate.shareRevokedAt = new Date();
    estimate.updatedBy = userId;
    await estimate.save();
    return { revoked: true };
  }

  async findByShareToken(token: string) {
    const estimate = await this.estimateModel
      .findOneAndUpdate(
        {
          shareToken: token,
          shareRevokedAt: { $exists: false },
          deletedAt: { $exists: false },
        },
        {
          $inc: { shareViewCount: 1 },
          $set: { shareLastViewedAt: new Date() },
        },
        { new: true },
      )
      .populate('clientId', 'name email')
      .populate('serviceId', 'name');
    if (!estimate) {
      throw new NotFoundException('This link is no longer valid');
    }
    return estimate;
  }
}
