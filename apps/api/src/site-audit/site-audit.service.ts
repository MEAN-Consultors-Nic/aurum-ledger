import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SiteMonitorChecker } from '../site-monitor/site-monitor-checker.service';
import { Estimate, EstimateDocument } from '../estimates/schemas/estimate.schema';
import { AiAnalystService } from './ai-analyst.service';
import { ConvertToEstimateDto, CreateSiteAuditDto } from './dto/site-audit.dto';
import { FetcherService } from './probes/fetcher.service';
import { HtmlAnalyzer } from './probes/html-analyzer.service';
import { PageSpeedService } from './probes/pagespeed.service';
import { ScreenshotService } from './probes/screenshot.service';
import { SitemapScanner } from './probes/sitemap-scanner.service';
import { WhoisService } from './probes/whois.service';
import {
  SiteAudit,
  SiteAuditDocument,
  SuggestedLineItem,
} from './schemas/site-audit.schema';

@Injectable()
export class SiteAuditService {
  private readonly logger = new Logger(SiteAuditService.name);

  constructor(
    @InjectModel(SiteAudit.name) private readonly model: Model<SiteAuditDocument>,
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
    private readonly fetcher: FetcherService,
    private readonly html: HtmlAnalyzer,
    private readonly pageSpeed: PageSpeedService,
    private readonly sitemap: SitemapScanner,
    private readonly whois: WhoisService,
    private readonly screenshot: ScreenshotService,
    private readonly ssl: SiteMonitorChecker,
    private readonly ai: AiAnalystService,
  ) {}

  async create(dto: CreateSiteAuditDto, userId?: Types.ObjectId) {
    const url = this.normalizeUrl(dto.url);
    const doc = await this.model.create({
      url: dto.url,
      normalizedUrl: url,
      partnerName: dto.partnerName,
      clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : null,
      clientName: dto.clientName,
      notes: dto.notes,
      status: 'pending',
      createdBy: userId,
      findings: {},
      ai: {},
    });
    // Fire-and-forget. Errors are caught inside run().
    void this.run(doc._id.toString());
    return doc;
  }

  async list(opts: { status?: string; q?: string } = {}) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (opts.status) filter.status = opts.status;
    if (opts.q) {
      const rx = new RegExp(opts.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ normalizedUrl: rx }, { partnerName: rx }, { clientName: rx }];
    }
    return this.model.find(filter).sort({ createdAt: -1 }).limit(200).lean();
  }

  async findOne(id: string) {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } }).lean();
    if (!doc) throw new NotFoundException('Audit not found');
    return doc;
  }

  async remove(id: string) {
    const doc = await this.model.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!doc) throw new NotFoundException('Audit not found');
    return { _id: doc._id.toString(), deleted: true };
  }

  /** Re-run AI analyses against the existing findings + screenshot. */
  async regenerateAi(id: string) {
    const doc = await this.model.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!doc) throw new NotFoundException('Audit not found');
    if (!this.ai.isReady) return doc.toObject();
    try {
      const headers = doc.findings.homepage ? {} : {}; // headers aren't stored — accept that constraint
      await this.runAi(doc, headers, '');
      doc.ai.generatedAt = new Date().toISOString();
      await doc.save();
    } catch (err) {
      this.logger.warn(`Regenerate AI failed for ${id}: ${(err as Error).message}`);
    }
    return doc.toObject();
  }

  async convertToEstimate(id: string, dto: ConvertToEstimateDto, userId?: Types.ObjectId) {
    const audit = await this.model.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!audit) throw new NotFoundException('Audit not found');

    const allItems = audit.ai.suggestedLineItems ?? [];
    const picked =
      dto.itemIndexes && dto.itemIndexes.length > 0
        ? dto.itemIndexes
            .filter((i) => i >= 0 && i < allItems.length)
            .map((i) => allItems[i])
        : allItems;

    const hourlyRate = dto.hourlyRate ?? 40;
    const totalHours = picked.reduce((acc, it) => acc + (it.hours || 0), 0);
    const amount = Math.round(totalHours * hourlyRate);

    const scope = this.itemsToMarkdown(picked, hourlyRate);
    const deliverables = picked.map((p) => p.title);

    const clientId = dto.clientId ?? (audit.clientId ? audit.clientId.toString() : null);
    if (!clientId) {
      throw new NotFoundException(
        'Missing clientId. Provide one in the request or set it on the audit first.',
      );
    }

    // Find any active service to satisfy schema requirement; the actual scope
    // is captured in `scope` + `deliverables`.
    const anyService = await this.estimateModel.db
      .collection('services')
      .findOne({ deletedAt: { $exists: false } }, { projection: { _id: 1 } });
    if (!anyService) {
      throw new NotFoundException(
        'No services configured. Create at least one service before converting.',
      );
    }

    const estimate = await this.estimateModel.create({
      clientId: new Types.ObjectId(clientId),
      serviceId: anyService._id,
      title: `Web Revamp — ${this.hostname(audit.normalizedUrl)}`,
      billingPeriod: 'one_time',
      amount,
      currency: 'USD',
      status: 'draft',
      scope,
      deliverables,
      notes:
        `${dto.notes ? dto.notes + '\n\n' : ''}Generado desde Site Audit (${audit._id.toString()}).\n` +
        `Tarifa aplicada: $${hourlyRate}/h · ${totalHours}h total.`,
      createdBy: userId,
      updatedBy: userId,
    });

    audit.convertedToEstimateId = estimate._id as any;
    await audit.save();

    return { estimateId: estimate._id.toString(), amount, totalHours };
  }

  // ------------------------------------------------------------------
  // Background pipeline
  // ------------------------------------------------------------------

  private async run(id: string): Promise<void> {
    const doc = await this.model.findById(id);
    if (!doc) return;
    doc.status = 'running';
    doc.startedAt = new Date();
    await doc.save();

    try {
      const url = doc.normalizedUrl;
      const parsed = new URL(url);
      const origin = `${parsed.protocol}//${parsed.host}`;

      // -------- Probes (mostly parallel) --------
      const [homepage, screenshotUrl, sitemap, whois, ssl, mobilePS, desktopPS] =
        await Promise.all([
          this.fetcher.fetch(url),
          this.screenshot.capture(url),
          this.sitemap.scan(origin),
          this.whois.lookup(parsed.hostname),
          this.runSsl(url),
          this.pageSpeed.run(url, 'mobile'),
          this.pageSpeed.run(url, 'desktop'),
        ]);

      doc.screenshotUrl = screenshotUrl;
      doc.findings.homepage = {
        finalUrl: homepage.finalUrl,
        status: homepage.status,
        responseMs: homepage.responseMs,
        contentLength: homepage.contentLength,
        server: homepage.headers['server'],
        poweredBy: homepage.headers['x-powered-by'],
        title: undefined,
        language: undefined,
      };
      doc.findings.pageSpeed = { mobile: mobilePS, desktop: desktopPS };
      doc.findings.whois = whois;
      doc.findings.ssl = ssl;

      let homepageText = '';
      const headersForAi = homepage.headers;
      const htmlHead = homepage.body ? homepage.body.slice(0, 5000) : '';

      if (homepage.ok && homepage.body) {
        const analyzed = this.html.analyze({
          url,
          body: homepage.body,
          headers: homepage.headers,
        });
        doc.findings.homepage.title = analyzed.title;
        doc.findings.homepage.language = analyzed.language;
        doc.findings.seo = {
          title: analyzed.title,
          titleLength: analyzed.title?.length,
          description: analyzed.description,
          descriptionLength: analyzed.description?.length,
          canonical: analyzed.canonical,
          robotsMeta: analyzed.robotsMeta,
          hreflang: analyzed.hreflang,
          openGraph: analyzed.openGraph,
          twitterCard: analyzed.twitterCard,
          schemaTypes: analyzed.schemaTypes,
          headings: analyzed.headings,
          images: analyzed.images,
          checks: analyzed.checks,
        };
        doc.findings.social = analyzed.social;
        doc.findings.stack = analyzed.stack;

        homepageText = this.html.extractTextSample(homepage.body, 5000);
      }

      doc.findings.sitemap = sitemap.sitemap;
      doc.findings.robots = sitemap.robots;
      doc.markModified('findings');
      await doc.save();

      // -------- AI layer (sequential, individual try/catch) --------
      if (this.ai.isReady) {
        await this.runAi(doc, headersForAi, htmlHead, sitemap.sampleUrls, homepageText);
      }

      doc.status = 'completed';
      doc.completedAt = new Date();
      await doc.save();
    } catch (err) {
      this.logger.error(`Audit ${id} failed: ${(err as Error).message}`);
      doc.status = 'failed';
      doc.error = (err as Error).message?.slice(0, 500);
      doc.completedAt = new Date();
      await doc.save();
    }
  }

  private async runAi(
    doc: SiteAuditDocument,
    headers: Record<string, string>,
    htmlHead: string,
    sampleUrls: string[] = [],
    homepageText = '',
  ) {
    const ai = doc.ai;
    ai.model = this.ai['openai'].textModel;

    // Sample interior pages for content analysis. Skip the homepage itself.
    const interiorUrls = sampleUrls
      .filter((u) => u !== doc.normalizedUrl && !u.endsWith('/'))
      .slice(0, 2);
    const interior: { url: string; text: string }[] = [];
    for (const u of interiorUrls) {
      try {
        const res = await this.fetcher.fetch(u, 10000);
        if (res.ok && res.body) {
          interior.push({ url: u, text: this.html.extractTextSample(res.body, 1500) });
        }
      } catch {
        /* ignore */
      }
    }

    const tasks: Promise<void>[] = [];

    tasks.push(
      this.ai
        .executiveSummary(doc.findings, homepageText)
        .then((s) => {
          ai.executiveSummary = s;
        })
        .catch((e) => this.logger.warn(`exec summary: ${(e as Error).message}`)),
    );

    tasks.push(
      this.ai
        .stackReasoning(doc.findings, headers, htmlHead)
        .then((s) => {
          ai.stackReasoning = s;
        })
        .catch((e) => this.logger.warn(`stack reasoning: ${(e as Error).message}`)),
    );

    tasks.push(
      this.ai
        .contentAnalysis(homepageText, interior)
        .then((s) => {
          ai.contentAnalysis = s;
        })
        .catch((e) => this.logger.warn(`content analysis: ${(e as Error).message}`)),
    );

    if (doc.screenshotUrl) {
      tasks.push(
        this.ai
          .visualCritique(doc.screenshotUrl)
          .then((s) => {
            ai.visualCritique = s;
          })
          .catch((e) => this.logger.warn(`visual critique: ${(e as Error).message}`)),
      );
    }

    await Promise.all(tasks);

    // Line items depends on executive summary, so it runs last.
    try {
      const items: SuggestedLineItem[] = await this.ai.suggestedLineItems(
        doc.findings,
        ai.executiveSummary ?? '',
      );
      ai.suggestedLineItems = items;
    } catch (e) {
      this.logger.warn(`line items: ${(e as Error).message}`);
    }

    ai.generatedAt = new Date().toISOString();
    doc.markModified('ai');
  }

  private async runSsl(url: string) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:') {
        return { error: 'site is not on HTTPS' };
      }
      const ssl = await this.ssl.ssl(url);
      const daysRemaining = Math.max(
        0,
        Math.round((ssl.validTo.getTime() - Date.now()) / 86400000),
      );
      return {
        validTo: ssl.validTo.toISOString(),
        daysRemaining,
        issuer: ssl.issuer,
      };
    } catch (err) {
      return { error: (err as Error).message };
    }
  }

  // ------------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------------

  private normalizeUrl(input: string): string {
    let url = input.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
      const parsed = new URL(url);
      parsed.hash = '';
      // Strip default trailing slash from path for consistency.
      return parsed.toString();
    } catch {
      return url;
    }
  }

  private hostname(url: string) {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return url;
    }
  }

  private itemsToMarkdown(items: SuggestedLineItem[], rate: number) {
    if (items.length === 0) return '';
    const lines = ['### Scope of work', ''];
    for (const it of items) {
      const subtotal = it.hours * rate;
      lines.push(`**${it.title}** — ${it.hours}h ($${subtotal.toLocaleString()})`);
      if (it.description) lines.push(it.description);
      lines.push('');
    }
    return lines.join('\n');
  }
}
