import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateClientDto } from './dto/create-client.dto';
import { FilterClientDto } from './dto/filter-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { Client, ClientDocument } from './schemas/client.schema';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';

@Injectable()
export class ClientsService {
  constructor(
    @InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
  ) {}

  async create(dto: CreateClientDto, userId?: Types.ObjectId) {
    const client = await this.clientModel.create({
      ...dto,
      createdBy: userId,
      updatedBy: userId,
      isActive: true,
    });
    return client;
  }

  async findAll(filter: FilterClientDto) {
    const page = Math.max(Number(filter.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);

    const query: Record<string, unknown> = { deletedAt: { $exists: false } };

    if (filter.isActive !== undefined) {
      query.isActive = filter.isActive === 'true';
    }

    if (filter.search) {
      query.name = { $regex: filter.search, $options: 'i' };
    }

    const [items, total] = await Promise.all([
      this.clientModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      this.clientModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const client = await this.clientModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async update(id: string, dto: UpdateClientDto, userId?: Types.ObjectId) {
    const client = await this.clientModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { ...dto, updatedBy: userId },
      { new: true },
    );
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const client = await this.clientModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    return client;
  }

  async summary(clientId: string) {
    const clientObjectId = new Types.ObjectId(clientId);

    const contracts = await this.contractModel.find({
      clientId: clientObjectId,
      deletedAt: { $exists: false },
    });

    const contractIds = contracts.map((contract) => contract._id);

    const payments = await this.paymentModel.aggregate([
      { $match: { contractId: { $in: contractIds } } },
      {
        $group: {
          _id: '$contractId',
          paidTotal: { $sum: '$amount' },
        },
      },
    ]);

    const paidByContract = new Map(
      payments.map((item) => [item._id.toString(), item.paidTotal]),
    );

    const now = new Date();
    const due30 = new Date();
    due30.setDate(now.getDate() + 30);

    let totalAdeudado = 0;
    let vencidos = 0;
    let proximosAVencer = 0;

    contracts.forEach((contract) => {
      const paid = paidByContract.get(contract._id.toString()) ?? 0;
      const balance = contract.amount - paid;
      if (balance > 0) {
        totalAdeudado += balance;
      }

      if (contract.endDate && contract.endDate < now && balance > 0) {
        vencidos += 1;
      }

      if (contract.endDate && contract.endDate >= now && contract.endDate <= due30) {
        proximosAVencer += 1;
      }
    });

    return {
      totalContratos: contracts.length,
      totalAdeudado,
      vencidos,
      proximosAVencer,
    };
  }
}
