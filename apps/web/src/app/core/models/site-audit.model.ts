export const SITE_AUDIT_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type SiteAuditStatus = (typeof SITE_AUDIT_STATUSES)[number];

export type PageSpeedSnapshot = {
  performance?: number;
  seo?: number;
  accessibility?: number;
  bestPractices?: number;
  lcp?: number;
  cls?: number;
  inp?: number;
  fcp?: number;
  ttfb?: number;
  topOpportunities?: { id: string; title: string; savingsMs?: number }[];
};

export type SeoCheck = {
  id: string;
  label: string;
  pass: boolean;
  detail?: string;
};

export type SuggestedLineItem = {
  title: string;
  description?: string;
  hours: number;
  category?: 'design' | 'development' | 'seo' | 'performance' | 'content' | 'other';
};

export type SiteAuditFindings = {
  homepage?: {
    finalUrl?: string;
    status?: number;
    responseMs?: number;
    contentLength?: number;
    server?: string;
    poweredBy?: string;
    title?: string;
    language?: string;
  };
  sitemap?: {
    found: boolean;
    sitemapUrl?: string;
    urlCount?: number;
    sampleUrls?: string[];
    lastModifiedSpread?: { earliest?: string; latest?: string };
  };
  robots?: { found: boolean; allowsAll?: boolean; disallowedPaths?: string[] };
  pageSpeed?: { mobile?: PageSpeedSnapshot; desktop?: PageSpeedSnapshot };
  seo?: {
    title?: string;
    titleLength?: number;
    description?: string;
    descriptionLength?: number;
    canonical?: string;
    robotsMeta?: string;
    hreflang: string[];
    openGraph: Record<string, string>;
    twitterCard: Record<string, string>;
    schemaTypes: string[];
    headings?: { h1: number; h2: number; h3: number };
    images?: { total: number; withoutAlt: number };
    checks: SeoCheck[];
  };
  social?: { platform: string; url: string }[];
  whois?: {
    registered?: string;
    ageYears?: number;
    registrar?: string;
    expiresAt?: string;
  };
  ssl?: { validTo?: string; daysRemaining?: number; issuer?: string; error?: string };
  stack?: {
    heuristics: { name: string; confidence: 'high' | 'medium' | 'low' }[];
  };
};

export type SiteAuditAi = {
  executiveSummary?: string;
  stackReasoning?: string;
  visualCritique?: string;
  contentAnalysis?: string;
  suggestedLineItems?: SuggestedLineItem[];
  generatedAt?: string;
  model?: string;
};

export type SiteAudit = {
  _id: string;
  url: string;
  normalizedUrl: string;
  partnerName?: string;
  clientId?: string | null;
  clientName?: string;
  notes?: string;
  status: SiteAuditStatus;
  error?: string;
  startedAt?: string;
  completedAt?: string;
  screenshotUrl?: string;
  findings: SiteAuditFindings;
  ai: SiteAuditAi;
  convertedToEstimateId?: string | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type CreateSiteAuditPayload = {
  url: string;
  partnerName?: string;
  clientId?: string;
  clientName?: string;
  notes?: string;
};

export type ConvertToEstimatePayload = {
  itemIndexes?: number[];
  clientId?: string;
  notes?: string;
  hourlyRate?: number;
};
