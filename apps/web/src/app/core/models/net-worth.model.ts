export type NetWorthBreakdownEntry = {
  label: string;
  type: 'cash' | 'asset' | 'debt';
  currency: 'USD' | 'NIO';
  nativeAmount: number;
  usdEquivalent: number;
};

export type NetWorthDelta = {
  ago: number;
  deltaUsd: number;
  percent: number;
};

export type NetWorthCurrent = {
  dateKey: string;
  date: string;
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
  breakdown: NetWorthBreakdownEntry[];
  generatedAt: string;
  deltas: {
    d30: NetWorthDelta | null;
    d90: NetWorthDelta | null;
    d365: NetWorthDelta | null;
  };
};

export type NetWorthSnapshot = {
  _id: string;
  dateKey: string;
  date: string;
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
