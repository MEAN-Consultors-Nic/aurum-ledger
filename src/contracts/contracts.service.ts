import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { CreateContractDto } from './dto/create-contract.dto';
import { FilterContractDto } from './dto/filter-contract.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Contract, ContractDocument } from './schemas/contract.schema';

@Injectable()
export class ContractsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
  ) {}

  async create(dto: CreateContractDto, userId?: Types.ObjectId) {
    this.validateDates(dto.billingPeriod, dto.startDate, dto.endDate);

    const contract = await this.contractModel.create({
      ...dto,
      clientId: new Types.ObjectId(dto.clientId),
      serviceId: new Types.ObjectId(dto.serviceId),
      startDate: new Date(dto.startDate),
      endDate: dto.endDate ? new Date(dto.endDate) : undefined,
      status: dto.status ?? 'active',
      currency: dto.currency ?? 'USD',
      createdBy: userId,
      updatedBy: userId,
      paidTotal: 0,
      paymentCount: 0,
    });

    return contract;
  }

  async findAll(filter: FilterContractDto) {
    const page = Math.max(Number(filter.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };

    if (filter.clientId) {
      query.clientId = new Types.ObjectId(filter.clientId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.dueFrom || filter.dueTo) {
      query.endDate = {} as Record<string, Date>;
      if (filter.dueFrom) {
        (query.endDate as Record<string, Date>).$gte = new Date(filter.dueFrom);
      }
      if (filter.dueTo) {
        (query.endDate as Record<string, Date>).$lte = new Date(filter.dueTo);
      }
    }

    if (filter.search) {
      query.$or = [
        { title: { $regex: filter.search, $options: 'i' } },
      ];
    }

    if (filter.onlyOpen === 'true') {
      query.$expr = { $lt: ['$paidTotal', '$amount'] };
    }

    const sort: Record<string, SortOrder> =
      filter.dueFrom || filter.dueTo ? { endDate: 1 } : { createdAt: -1 };

    const [items, total] = await Promise.all([
      this.contractModel
        .find(query)
        .populate('clientId', 'name')
        .populate('serviceId', 'name')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      this.contractModel.countDocuments(query),
    ]);

    const enriched = items.map((contract) => {
      const balance = contract.amount - contract.paidTotal;
      const financialStatus = this.resolveFinancialStatus(contract.amount, contract.paidTotal);
      return {
        ...contract.toObject(),
        balance,
        financialStatus,
      };
    });

    return { items: enriched, total, page, limit };
  }

  async findById(id: string) {
    const contract = await this.contractModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    })
      .populate('clientId', 'name')
      .populate('serviceId', 'name');
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return {
      ...contract.toObject(),
      balance: contract.amount - contract.paidTotal,
      financialStatus: this.resolveFinancialStatus(contract.amount, contract.paidTotal),
    };
  }

  async getContractById(id: string) {
    const contract = await this.contractModel.findById(id);
    if (!contract || contract.deletedAt) {
      throw new NotFoundException('Contract not found');
    }
    return contract;
  }

  async update(id: string, dto: UpdateContractDto, userId?: Types.ObjectId) {
    const existing = await this.contractModel.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException('Contract not found');
    }

    const billingPeriod = dto.billingPeriod ?? existing.billingPeriod;
    const startDateStr = dto.startDate ?? existing.startDate.toISOString();
    const endDateStr = dto.endDate ?? existing.endDate?.toISOString();
    this.validateDates(billingPeriod, startDateStr, endDateStr);

    const { clientId, serviceId, startDate, endDate, ...restDto } = dto;
    const payload: Partial<Contract> = {
      ...restDto,
      updatedBy: userId,
    };

    if (clientId) {
      payload.clientId = new Types.ObjectId(clientId);
    }

    if (serviceId) {
      payload.serviceId = new Types.ObjectId(serviceId);
    }

    if (dto.startDate) {
      payload.startDate = new Date(dto.startDate);
    }

    if (dto.endDate) {
      payload.endDate = new Date(dto.endDate);
    }

    const contract = await this.contractModel.findByIdAndUpdate(id, payload, {
      new: true,
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async cancel(id: string, userId?: Types.ObjectId) {
    const contract = await this.contractModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { status: 'cancelled', updatedBy: userId },
      { new: true },
    );

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const contract = await this.contractModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    return contract;
  }

  async financials(id: string) {
    const contract = await this.contractModel.findById(id);
    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const balance = contract.amount - contract.paidTotal;
    return {
      amount: contract.amount,
      paidTotal: contract.paidTotal,
      balance,
      paymentCount: contract.paymentCount,
      lastPaymentDate: contract.lastPaymentDate,
      status: this.resolveFinancialStatus(contract.amount, contract.paidTotal),
    };
  }

  async updateFinancials(
    contractId: Types.ObjectId,
    paidTotal: number,
    paymentCount: number,
    lastPaymentDate?: Date,
  ) {
    await this.contractModel.findByIdAndUpdate(contractId, {
      paidTotal,
      paymentCount,
      lastPaymentDate,
    });
  }

  private validateDates(
    billingPeriod: string,
    startDate: string,
    endDate?: string,
  ) {
    if (billingPeriod !== 'one_time' && !endDate) {
      throw new BadRequestException('endDate is required for recurring contracts');
    }

    if (endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      if (end < start) {
        throw new BadRequestException('endDate must be after startDate');
      }
    }
  }

  private resolveFinancialStatus(amount: number, paidTotal: number) {
    if (paidTotal <= 0) {
      return 'unpaid';
    }
    if (paidTotal >= amount) {
      return 'paid';
    }
    return 'partial';
  }
}
