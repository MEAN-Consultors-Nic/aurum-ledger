import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type SiteAuditDocument = HydratedDocument<SiteAudit>;

export const SITE_AUDIT_STATUSES = [
  'pending',
  'running',
  'completed',
  'failed',
] as const;
export type SiteAuditStatus = (typeof SITE_AUDIT_STATUSES)[number];

/**
 * Snapshot of every probe + AI analysis we run against a target URL.
 * `findings` is intentionally schemaless (Mixed) because each probe owns
 * the shape of its sub-object; rendering it is the frontend's job.
 */
@Schema({ timestamps: true })
export class SiteAudit {
  @Prop({ required: true, trim: true })
  url: string;

  @Prop({ required: true, trim: true })
  normalizedUrl: string;

  @Prop()
  partnerName?: string;

  @Prop({ type: Types.ObjectId, ref: 'Client', default: null })
  clientId?: Types.ObjectId | null;

  @Prop()
  clientName?: string;

  @Prop()
  notes?: string;

  @Prop({ type: String, enum: SITE_AUDIT_STATUSES, default: 'pending' })
  status: SiteAuditStatus;

  @Prop()
  error?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  completedAt?: Date;

  /** Saved screenshot CDN url (Microlink). Not permanent. */
  @Prop()
  screenshotUrl?: string;

  /** Free-tier probe results. Shape per probe is documented in services. */
  @Prop({ type: Object, default: {} })
  findings: {
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
    pageSpeed?: {
      mobile?: PageSpeedSnapshot;
      desktop?: PageSpeedSnapshot;
    };
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
      raw?: unknown;
    };
    ssl?: { validTo?: string; daysRemaining?: number; issuer?: string; error?: string };
    stack?: {
      heuristics: { name: string; confidence: 'high' | 'medium' | 'low' }[];
    };
  };

  /** GPT-generated commentary. Each field is independently regenerable. */
  @Prop({ type: Object, default: {} })
  ai: {
    executiveSummary?: string;
    stackReasoning?: string;
    visualCritique?: string;
    contentAnalysis?: string;
    suggestedLineItems?: SuggestedLineItem[];
    generatedAt?: string;
    model?: string;
  };

  @Prop({ type: Types.ObjectId, ref: 'Estimate', default: null })
  convertedToEstimateId?: Types.ObjectId | null;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  createdBy?: Types.ObjectId;

  @Prop()
  deletedAt?: Date;
}

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

export const SiteAuditSchema = SchemaFactory.createForClass(SiteAudit);
SiteAuditSchema.index({ status: 1, createdAt: -1 });
SiteAuditSchema.index({ normalizedUrl: 1 });
SiteAuditSchema.index({ partnerName: 1, createdAt: -1 });
