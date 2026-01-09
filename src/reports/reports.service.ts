import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly config: ConfigService,
  ) {}

  async dashboardOverview() {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    const due30 = new Date(now);
    due30.setDate(now.getDate() + 30);

    const fxRate = this.getFxRate();
    const [receivableAggregate, paidThisMonth, dueNext30Days, overdueCount] =
      await Promise.all([
        this.contractModel.aggregate([
          { $match: { deletedAt: { $exists: false } } },
          {
            $project: {
              currency: {
                $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'],
              },
              receivable: { $subtract: ['$amount', '$paidTotal'] },
            },
          },
          {
            $group: {
              _id: '$currency',
              totalReceivable: { $sum: '$receivable' },
            },
          },
        ]),
        this.paymentModel.aggregate([
          {
            $match: {
              paymentDate: { $gte: startOfMonth, $lte: endOfMonth },
            },
          },
          {
            $project: {
              applied: { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
              currency: {
                $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'],
              },
              exchangeRate: { $ifNull: ['$exchangeRate', 1] },
            },
          },
          {
            $group: {
              _id: null,
              totalUsd: {
                $sum: {
                  $cond: [
                    { $eq: ['$currency', 'USD'] },
                    '$applied',
                    { $divide: ['$applied', '$exchangeRate'] },
                  ],
                },
              },
              totalNio: {
                $sum: {
                  $cond: [
                    { $eq: ['$currency', 'NIO'] },
                    '$applied',
                    { $multiply: ['$applied', '$exchangeRate'] },
                  ],
                },
              },
            },
          },
        ]),
        this.contractModel.aggregate([
          {
            $match: {
              deletedAt: { $exists: false },
              endDate: { $gte: now, $lte: due30 },
            },
          },
          {
            $group: {
              _id: null,
              count: {
                $sum: {
                  $cond: [{ $gt: [{ $subtract: ['$amount', '$paidTotal'] }, 0] }, 1, 0],
                },
              },
            },
          },
        ]),
        this.contractModel.aggregate([
          {
            $match: {
              deletedAt: { $exists: false },
              endDate: { $lt: now },
            },
          },
          {
            $group: {
              _id: null,
              count: {
                $sum: {
                  $cond: [{ $gt: [{ $subtract: ['$amount', '$paidTotal'] }, 0] }, 1, 0],
                },
              },
            },
          },
        ]),
      ]);

    const totals = receivableAggregate.reduce(
      (acc, item) => {
        if (item._id === 'USD') {
          acc.totalReceivableUsd += item.totalReceivable;
          acc.totalReceivableNio += item.totalReceivable * fxRate;
        } else if (item._id === 'NIO') {
          acc.totalReceivableNio += item.totalReceivable;
          acc.totalReceivableUsd += item.totalReceivable / fxRate;
        }
        return acc;
      },
      { totalReceivableUsd: 0, totalReceivableNio: 0 },
    );

    return {
      totalReceivableUsd: totals.totalReceivableUsd,
      totalReceivableNio: totals.totalReceivableNio,
      totalPaidThisMonthUsd: paidThisMonth[0]?.totalUsd ?? 0,
      totalPaidThisMonthNio: paidThisMonth[0]?.totalNio ?? 0,
      dueNext30Days: dueNext30Days[0]?.count ?? 0,
      overdueCount: overdueCount[0]?.count ?? 0,
    };
  }

  async receivables(groupBy: 'client' | 'service') {
    const groupField = groupBy === 'service' ? '$serviceId' : '$clientId';
    const lookupCollection = groupBy === 'service' ? 'services' : 'clients';
    const labelField = groupBy === 'service' ? 'name' : 'name';
    const fxRate = this.getFxRate();

    return this.contractModel.aggregate([
      { $match: { deletedAt: { $exists: false } } },
      {
        $project: {
          groupId: groupField,
          currency: {
            $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'],
          },
          receivable: { $subtract: ['$amount', '$paidTotal'] },
        },
      },
      {
        $group: {
          _id: '$groupId',
          totalUsd: {
            $sum: {
              $cond: [
                { $eq: ['$currency', 'USD'] },
                '$receivable',
                { $divide: ['$receivable', fxRate] },
              ],
            },
          },
          totalNio: {
            $sum: {
              $cond: [
                { $eq: ['$currency', 'NIO'] },
                '$receivable',
                { $multiply: ['$receivable', fxRate] },
              ],
            },
          },
        },
      },
      {
        $lookup: {
          from: lookupCollection,
          localField: '_id',
          foreignField: '_id',
          as: 'entity',
        },
      },
      { $unwind: { path: '$entity', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: '$_id',
          name: `$entity.${labelField}`,
          totalUsd: 1,
          totalNio: 1,
        },
      },
      { $sort: { totalUsd: -1 } },
    ]);
  }

  async paymentsReport(from?: string, to?: string) {
    const query: Record<string, unknown> = {};
    if (from || to) {
      query.paymentDate = {} as Record<string, Date>;
      if (from) {
        (query.paymentDate as Record<string, Date>).$gte = new Date(from);
      }
      if (to) {
        (query.paymentDate as Record<string, Date>).$lte = new Date(to);
      }
    }

    const [items, total] = await Promise.all([
      this.paymentModel
        .find(query)
        .populate('clientId', 'name')
        .populate('contractId', 'title')
        .sort({ paymentDate: -1 }),
      this.paymentModel.aggregate([
        { $match: query },
        {
          $project: {
            applied: { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
            currency: {
              $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'],
            },
            exchangeRate: { $ifNull: ['$exchangeRate', 1] },
          },
        },
        {
          $group: {
            _id: null,
            totalUsd: {
              $sum: {
                $cond: [
                  { $eq: ['$currency', 'USD'] },
                  '$applied',
                  { $divide: ['$applied', '$exchangeRate'] },
                ],
              },
            },
            totalNio: {
              $sum: {
                $cond: [
                  { $eq: ['$currency', 'NIO'] },
                  '$applied',
                  { $multiply: ['$applied', '$exchangeRate'] },
                ],
              },
            },
          },
        },
      ]),
    ]);

    return {
      totalUsd: total[0]?.totalUsd ?? 0,
      totalNio: total[0]?.totalNio ?? 0,
      items,
    };
  }

  private getFxRate() {
    const raw = this.config.get<string>('FX_USD_TO_NIO') ?? '36';
    const rate = Number(raw);
    return Number.isFinite(rate) && rate > 0 ? rate : 36;
  }
}
