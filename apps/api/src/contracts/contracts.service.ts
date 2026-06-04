import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { ProjectsService } from '../projects/projects.service';
import { ServicesService } from '../services/services.service';
import { CreateContractDto } from './dto/create-contract.dto';
import { FilterContractDto } from './dto/filter-contract.dto';
import { OmitPaymentDto } from './dto/omit-payment.dto';
import { UpdateContractDto } from './dto/update-contract.dto';
import { Contract, ContractDocument } from './schemas/contract.schema';

@Injectable()
export class ContractsService {
  private readonly logger = new Logger(ContractsService.name);

  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    private readonly projectsService: ProjectsService,
    private readonly servicesService: ServicesService,
  ) {}

  async create(dto: CreateContractDto, userId?: Types.ObjectId) {
    this.validateDates(dto.billingPeriod, dto.startDate, dto.endDate);

    const { createProject, ...contractFields } = dto;
    const shouldCreateProject = createProject !== false; // default true

    const contract = await this.contractModel.create({
      ...contractFields,
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

    if (contract.status === 'active' && shouldCreateProject) {
      this.spawnProjectFor(contract, userId).catch((err) => {
        this.logger.error(`Failed to spawn project for contract ${contract._id}: ${err.message}`);
      });
    }

    return contract;
  }

  private async spawnProjectFor(contract: ContractDocument, userId?: Types.ObjectId) {
    let serviceName: string | undefined;
    try {
      const service = await this.servicesService.findById(contract.serviceId.toString());
      serviceName = service?.name;
    } catch {
      // service lookup is best-effort; project still gets created without it
    }
    await this.projectsService.createFromContract({
      contractId: contract._id as Types.ObjectId,
      clientId: contract.clientId,
      serviceId: contract.serviceId,
      contractTitle: contract.title,
      serviceName,
      startDate: contract.startDate,
      endDate: contract.endDate,
      userId,
    });
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
      const omitted = !!contract.paymentOmittedAt;
      const balance = omitted ? 0 : contract.amount - contract.paidTotal;
      const financialStatus = this.resolveFinancialStatus(
        contract.amount,
        contract.paidTotal,
        omitted,
      );
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

    const omitted = !!contract.paymentOmittedAt;
    return {
      ...contract.toObject(),
      balance: omitted ? 0 : contract.amount - contract.paidTotal,
      financialStatus: this.resolveFinancialStatus(contract.amount, contract.paidTotal, omitted),
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

  async omitPayment(id: string, dto: OmitPaymentDto, userId?: Types.ObjectId) {
    const existing = await this.contractModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!existing) {
      throw new NotFoundException('Contract not found');
    }
    if (existing.paymentOmittedAt) {
      throw new BadRequestException('Payment is already omitted for this contract');
    }
    const balance = existing.amount - existing.paidTotal;
    if (balance <= 0) {
      throw new BadRequestException('No pending balance to omit');
    }

    const contract = await this.contractModel.findByIdAndUpdate(
      id,
      {
        paymentOmittedAt: new Date(),
        paymentOmissionNote: dto.note,
        paymentOmittedBy: userId,
        updatedBy: userId,
      },
      { new: true },
    );

    return contract;
  }

  async restorePayment(id: string, userId?: Types.ObjectId) {
    const existing = await this.contractModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!existing) {
      throw new NotFoundException('Contract not found');
    }
    if (!existing.paymentOmittedAt) {
      throw new BadRequestException('Payment is not omitted for this contract');
    }

    const contract = await this.contractModel.findByIdAndUpdate(
      id,
      {
        $unset: { paymentOmittedAt: 1, paymentOmissionNote: 1, paymentOmittedBy: 1 },
        updatedBy: userId,
      },
      { new: true },
    );

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

    const omitted = !!contract.paymentOmittedAt;
    const balance = omitted ? 0 : contract.amount - contract.paidTotal;
    return {
      amount: contract.amount,
      paidTotal: contract.paidTotal,
      balance,
      paymentCount: contract.paymentCount,
      lastPaymentDate: contract.lastPaymentDate,
      status: this.resolveFinancialStatus(contract.amount, contract.paidTotal, omitted),
      paymentOmittedAt: contract.paymentOmittedAt,
      paymentOmissionNote: contract.paymentOmissionNote,
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

  private resolveFinancialStatus(amount: number, paidTotal: number, omitted = false) {
    if (omitted) {
      return 'omitted';
    }
    if (paidTotal <= 0) {
      return 'unpaid';
    }
    if (paidTotal >= amount) {
      return 'paid';
    }
    return 'partial';
  }
}
