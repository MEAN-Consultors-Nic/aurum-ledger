export type SiteMonitorItem = {
  _id: string;
  name: string;
  url: string;
  projectId?: string | { _id: string; name: string };
  isActive: boolean;

  lastCheckedAt?: string;
  lastHttpStatus?: number;
  lastResponseMs?: number;
  isUp: boolean;
  lastDownAt?: string;
  lastErrorMessage?: string;

  sslExpiresAt?: string;
  sslIssuer?: string;
  sslCheckedAt?: string;
  sslWarnDays: number;

  domainExpiresAt?: string;
  domainWarnDays: number;

  createdAt?: string;
  updatedAt?: string;
};
