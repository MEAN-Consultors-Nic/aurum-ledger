import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Account, AccountDocument } from '../accounts/schemas/account.schema';
import { Asset, AssetDocument } from '../assets/schemas/asset.schema';
import { Loan, LoanDocument } from '../loans/schemas/loan.schema';
import {
  LoanPaymentOccurrence,
  LoanPaymentOccurrenceDocument,
} from '../loans/schemas/loan-payment-occurrence.schema';
import { SettingsService } from '../settings/settings.service';
import { Transaction, TransactionDocument } from '../transactions/schemas/transaction.schema';
import {
  NetWorthSnapshot,
  NetWorthSnapshotDocument,
} from './schemas/net-worth-snapshot.schema';

const DEFAULT_FX = 36;

export type NetWorthBreakdownEntry = {
  label: string;
  type: 'cash' | 'asset' | 'debt';
  currency: 'USD' | 'NIO';
  nativeAmount: number;
  usdEquivalent: number;
};

export type NetWorthSnapshotPayload = {
  dateKey: string;
  date: Date;
  cashUsd: number;
  cashNio: number;
  assetsUsd: number;
  assetsNio: number;
  debtsUsd: number;
  debtsNio: number;
  fxRate: number;
  netWorthUsd: number;
  netWorthNativeUsd: number;
  netWorthNativeNio: number;
};

export type NetWorthCurrent = NetWorthSnapshotPayload & {
  breakdown: NetWorthBreakdownEntry[];
  generatedAt: Date;
};

@Injectable()
export class NetWorthService {
  private readonly logger = new Logger(NetWorthService.name);

  constructor(
    @InjectModel(NetWorthSnapshot.name)
    private readonly snapshotModel: Model<NetWorthSnapshotDocument>,
    @InjectModel(Account.name) private readonly accountModel: Model<AccountDocument>,
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Asset.name) private readonly assetModel: Model<AssetDocument>,
    @InjectModel(Loan.name) private readonly loanModel: Model<LoanDocument>,
    @InjectModel(LoanPaymentOccurrence.name)
    private readonly loanOccurrenceModel: Model<LoanPaymentOccurrenceDocument>,
    private readonly settingsService: SettingsService,
  ) {}

  /** Live calculation: read everything and aggregate. Does not persist. */
  async computeCurrent(): Promise<NetWorthCurrent> {
    const fxRate = (await this.settingsService.getNumber('fxUsdToNio')) ?? DEFAULT_FX;

    // ----- Cash (active accounts + their transactions) -----
    const accounts = await this.accountModel
      .find({ deletedAt: { $exists: false }, isActive: true })
      .select('_id name currency initialBalance');
    const accountIds = accounts.map((a) => a._id);
    const txByCurrency = await this.transactionModel.aggregate([
      {
        $match: {
          voidedAt: { $exists: false },
          accountId: { $in: accountIds },
        },
      },
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
    ]);
    const txMap: Record<'USD' | 'NIO', number> = { USD: 0, NIO: 0 };
    for (const row of txByCurrency) {
      txMap[row._id as 'USD' | 'NIO'] = row.total ?? 0;
    }
    let cashUsd = 0;
    let cashNio = 0;
    const cashBreakdown: NetWorthBreakdownEntry[] = [];
    for (const acc of accounts) {
      // Approximate per-account balance for the breakdown (uses initial balance only;
      // the txMap totals are folded into cashUsd/cashNio below so the aggregate stays right).
      const native = acc.initialBalance ?? 0;
      const usdEq = acc.currency === 'USD' ? native : native / fxRate;
      cashBreakdown.push({
        label: acc.name,
        type: 'cash',
        currency: acc.currency,
        nativeAmount: native,
        usdEquivalent: usdEq,
      });
    }
    // initial balances by currency
    for (const acc of accounts) {
      if (acc.currency === 'USD') cashUsd += acc.initialBalance ?? 0;
      else cashNio += acc.initialBalance ?? 0;
    }
    cashUsd += txMap.USD;
    cashNio += txMap.NIO;

    // ----- Assets -----
    const assets = await this.assetModel
      .find({ deletedAt: { $exists: false } })
      .select('_id name type currency currentValue');
    let assetsUsd = 0;
    let assetsNio = 0;
    const assetBreakdown: NetWorthBreakdownEntry[] = [];
    for (const a of assets) {
      const native = a.currentValue ?? 0;
      if (a.currency === 'USD') assetsUsd += native;
      else assetsNio += native;
      assetBreakdown.push({
        label: a.name,
        type: 'asset',
        currency: a.currency,
        nativeAmount: native,
        usdEquivalent: a.currency === 'USD' ? native : native / fxRate,
      });
    }

    // ----- Debts (active loans, outstanding = principal - confirmed payments) -----
    const loans = await this.loanModel
      .find({ isActive: true })
      .select('_id name principal currency');
    let debtsUsd = 0;
    let debtsNio = 0;
    const debtBreakdown: NetWorthBreakdownEntry[] = [];
    if (loans.length > 0) {
      const loanIds = loans.map((l) => l._id);
      const paidByLoan = await this.loanOccurrenceModel.aggregate([
        { $match: { loanId: { $in: loanIds }, status: 'confirmed' } },
        { $group: { _id: '$loanId', total: { $sum: '$amount' } } },
      ]);
      const paidMap = new Map<string, number>();
      for (const row of paidByLoan) {
        paidMap.set(String(row._id), row.total ?? 0);
      }
      for (const loan of loans) {
        const paid = paidMap.get(String(loan._id)) ?? 0;
        const outstanding = Math.max(0, (loan.principal ?? 0) - paid);
        if (outstanding <= 0) continue;
        if (loan.currency === 'USD') debtsUsd += outstanding;
        else debtsNio += outstanding;
        debtBreakdown.push({
          label: loan.name,
          type: 'debt',
          currency: loan.currency,
          nativeAmount: outstanding,
          usdEquivalent: loan.currency === 'USD' ? outstanding : outstanding / fxRate,
        });
      }
    }

    // ----- Aggregate -----
    const netWorthNativeUsd = cashUsd + assetsUsd - debtsUsd;
    const netWorthNativeNio = cashNio + assetsNio - debtsNio;
    const netWorthUsd = netWorthNativeUsd + netWorthNativeNio / fxRate;
    const now = new Date();

    return {
      dateKey: this.dateKey(now),
      date: now,
      cashUsd,
      cashNio,
      assetsUsd,
      assetsNio,
      debtsUsd,
      debtsNio,
      fxRate,
      netWorthUsd,
      netWorthNativeUsd,
      netWorthNativeNio,
      breakdown: [...cashBreakdown, ...assetBreakdown, ...debtBreakdown],
      generatedAt: now,
    };
  }

  /** Compute current state and upsert today's snapshot. */
  async snapshot(): Promise<NetWorthSnapshotPayload> {
    const current = await this.computeCurrent();
    const { breakdown: _b, generatedAt: _g, ...payload } = current;
    await this.snapshotModel.findOneAndUpdate(
      { dateKey: payload.dateKey },
      { $set: payload },
      { upsert: true, new: true },
    );
    this.logger.log(
      `snapshot(): ${payload.dateKey} netWorthUsd=${payload.netWorthUsd.toFixed(2)}`,
    );
    return payload;
  }

  /** Returns snapshots for the last N days (default 90), oldest first. */
  async history(days = 90) {
    const from = new Date();
    from.setDate(from.getDate() - days);
    return this.snapshotModel.find({ date: { $gte: from } }).sort({ date: 1 });
  }

  /** Returns a single snapshot for the given dateKey, or null. */
  async at(dateKey: string) {
    return this.snapshotModel.findOne({ dateKey });
  }

  /** Computes delta vs N days ago (in USD), reading from history when available. */
  async deltas(currentUsd: number) {
    const lookback = [30, 90, 365];
    const buckets: Record<string, { ago: number; deltaUsd: number; percent: number } | null> = {};
    const now = new Date();
    for (const days of lookback) {
      const target = new Date(now);
      target.setDate(target.getDate() - days);
      const key = this.dateKey(target);
      const snap = await this.snapshotModel
        .findOne({ dateKey: { $lte: key } })
        .sort({ dateKey: -1 });
      if (!snap) {
        buckets[`d${days}`] = null;
      } else {
        const deltaUsd = currentUsd - snap.netWorthUsd;
        const percent = snap.netWorthUsd === 0 ? 0 : (deltaUsd / snap.netWorthUsd) * 100;
        buckets[`d${days}`] = { ago: snap.netWorthUsd, deltaUsd, percent };
      }
    }
    return buckets;
  }

  private dateKey(d: Date): string {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(d.getUTCDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
}
