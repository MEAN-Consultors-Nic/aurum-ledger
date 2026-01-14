import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Account, AccountDocument } from '../accounts/schemas/account.schema';
import { Payment, PaymentDocument } from '../payments/schemas/payment.schema';
import {
  PlannedIncomeOccurrence,
  PlannedIncomeOccurrenceDocument,
} from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(PlannedIncomeOccurrence.name)
    private readonly plannedIncomeOccurrenceModel: Model<PlannedIncomeOccurrenceDocument>,
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

  async trends(months = 6) {
    const totalMonths = Math.min(Math.max(Number(months || 6), 1), 24);
    const fxRate = this.getFxRate();
    const now = new Date();
    const results: Array<{
      month: string;
      totalReceivableUsd: number;
      totalReceivableNio: number;
      totalPaidUsd: number;
      totalPaidNio: number;
      balanceUsd: number;
      balanceNio: number;
    }> = [];

    for (let offset = totalMonths - 1; offset >= 0; offset -= 1) {
      const cursor = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59, 999);

      const [contractTotals, paidThisMonth, paidToDate, accountTotals, txTotals] = await Promise.all([
        this.contractModel.aggregate([
          { $match: { deletedAt: { $exists: false }, createdAt: { $lte: end } } },
          {
            $project: {
              currency: { $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'] },
              amount: 1,
            },
          },
          {
            $group: {
              _id: '$currency',
              total: { $sum: '$amount' },
            },
          },
        ]),
        this.paymentModel.aggregate([
          { $match: { paymentDate: { $gte: start, $lte: end } } },
          {
            $project: {
              applied: { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
              currency: { $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'] },
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
        this.paymentModel.aggregate([
          { $match: { paymentDate: { $lte: end } } },
          {
            $project: {
              applied: { $add: ['$amount', { $ifNull: ['$retentionAmount', 0] }] },
              currency: { $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'] },
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
        this.accountModel.aggregate([
          { $match: { deletedAt: { $exists: false } } },
          { $group: { _id: '$currency', total: { $sum: '$initialBalance' } } },
        ]),
        this.transactionModel.aggregate([
          { $match: { date: { $lte: end }, voidedAt: { $exists: false } } },
          {
            $group: {
              _id: '$currency',
              total: {
                $sum: {
                  $cond: [{ $eq: ['$flow', 'in'] }, '$amount', { $multiply: ['$amount', -1] }],
                },
              },
            },
          },
        ]),
      ]);

      const contractTotalsByCurrency = contractTotals.reduce(
        (acc, item) => {
          if (item._id === 'USD') {
            acc.usd += item.total || 0;
            acc.nio += (item.total || 0) * fxRate;
          } else if (item._id === 'NIO') {
            acc.nio += item.total || 0;
            acc.usd += (item.total || 0) / fxRate;
          }
          return acc;
        },
        { usd: 0, nio: 0 },
      );

      const paidToDateUsd = paidToDate[0]?.totalUsd ?? 0;
      const paidToDateNio = paidToDate[0]?.totalNio ?? 0;

      const receivableUsd = contractTotalsByCurrency.usd - paidToDateUsd;
      const receivableNio = contractTotalsByCurrency.nio - paidToDateNio;

      const balances = { USD: 0, NIO: 0 };
      accountTotals.forEach((item) => {
        balances[item._id as 'USD' | 'NIO'] += item.total || 0;
      });
      txTotals.forEach((item) => {
        balances[item._id as 'USD' | 'NIO'] += item.total || 0;
      });

      results.push({
        month: `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`,
        totalReceivableUsd: receivableUsd,
        totalReceivableNio: receivableNio,
        totalPaidUsd: paidThisMonth[0]?.totalUsd ?? 0,
        totalPaidNio: paidThisMonth[0]?.totalNio ?? 0,
        balanceUsd: balances.USD,
        balanceNio: balances.NIO,
      });
    }

    return results;
  }

  async projectedIncome(month?: string) {
    const fxRate = this.getFxRate();
    const now = new Date();
    let year = now.getFullYear();
    let monthIndex = now.getMonth();

    if (month) {
      const [yearStr, monthStr] = month.split('-');
      year = Number(yearStr);
      monthIndex = Math.max(0, Number(monthStr) - 1);
    }

    const start = new Date(year, monthIndex, 1);
    const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);

    const [plannedAgg, contractAgg] = await Promise.all([
      this.plannedIncomeOccurrenceModel.aggregate([
        {
          $match: {
            date: { $gte: start, $lte: end },
            status: { $ne: 'omitted' },
          },
        },
        {
          $project: {
            currency: { $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'] },
            effectiveAmount: { $ifNull: ['$receivedAmount', '$amount'] },
          },
        },
        {
          $group: {
            _id: '$currency',
            total: { $sum: '$effectiveAmount' },
          },
        },
      ]),
      this.contractModel.aggregate([
        {
          $match: {
            deletedAt: { $exists: false },
            endDate: { $gte: start, $lte: end },
          },
        },
        {
          $project: {
            currency: { $cond: [{ $eq: ['$currency', 'NIO'] }, 'NIO', 'USD'] },
            receivable: { $subtract: ['$amount', '$paidTotal'] },
          },
        },
        {
          $match: {
            receivable: { $gt: 0 },
          },
        },
        {
          $group: {
            _id: '$currency',
            total: { $sum: '$receivable' },
          },
        },
      ]),
    ]);

    const plannedTotals = plannedAgg.reduce(
      (acc, item) => {
        if (item._id === 'USD') {
          acc.usd += item.total || 0;
          acc.nio += (item.total || 0) * fxRate;
        } else if (item._id === 'NIO') {
          acc.nio += item.total || 0;
          acc.usd += (item.total || 0) / fxRate;
        }
        return acc;
      },
      { usd: 0, nio: 0 },
    );

    const contractTotals = contractAgg.reduce(
      (acc, item) => {
        if (item._id === 'USD') {
          acc.usd += item.total || 0;
          acc.nio += (item.total || 0) * fxRate;
        } else if (item._id === 'NIO') {
          acc.nio += item.total || 0;
          acc.usd += (item.total || 0) / fxRate;
        }
        return acc;
      },
      { usd: 0, nio: 0 },
    );

    return {
      month: `${year}-${String(monthIndex + 1).padStart(2, '0')}`,
      plannedUsd: plannedTotals.usd,
      plannedNio: plannedTotals.nio,
      contractUsd: contractTotals.usd,
      contractNio: contractTotals.nio,
      totalUsd: plannedTotals.usd + contractTotals.usd,
      totalNio: plannedTotals.nio + contractTotals.nio,
    };
  }

  private getFxRate() {
    const raw = this.config.get<string>('FX_USD_TO_NIO') ?? '36';
    const rate = Number(raw);
    return Number.isFinite(rate) && rate > 0 ? rate : 36;
  }
}
