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
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Audit not found');
    }
    const doc = await this.model.findOneAndUpdate(
      { _id: new Types.ObjectId(id), deletedAt: { $exists: false } },
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

  /**
   * Hard ceiling for the whole audit. With per-step withTimeout caps a
   * normal run completes in under 2 minutes; this is the belt that catches
   * any pathology not handled by the per-step caps.
   */
  private static readonly WALL_CLOCK_MS = 3 * 60 * 1000;

  /**
   * Per-step caps. The point is to NOT trust each probe's internal
   * library-level timeout — withTimeout() races every call against a
   * setTimeout so we always move on within these budgets even if a fetch
   * gets stuck at the socket layer.
   */
  private static readonly TIMEOUT_HOMEPAGE_MS = 12000;
  private static readonly TIMEOUT_SCREENSHOT_MS = 18000;
  private static readonly TIMEOUT_SITEMAP_MS = 20000;
  private static readonly TIMEOUT_WHOIS_MS = 12000;
  private static readonly TIMEOUT_SSL_MS = 12000;
  private static readonly TIMEOUT_PAGESPEED_MS = 35000;
  private static readonly TIMEOUT_INTERIOR_FETCH_MS = 8000;
  private static readonly TIMEOUT_AI_TEXT_MS = 60000;
  private static readonly TIMEOUT_AI_VISION_MS = 75000;

  private async run(id: string): Promise<void> {
    const doc = await this.model.findById(id);
    if (!doc) return;
    doc.status = 'running';
    doc.startedAt = new Date();
    await doc.save();

    try {
      await Promise.race([
        this.runPipeline(doc),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error('Audit exceeded wall-clock timeout')),
            SiteAuditService.WALL_CLOCK_MS,
          ),
        ),
      ]);
      doc.status = 'completed';
      doc.completedAt = new Date();
      await doc.save();
    } catch (err) {
      this.logger.error(`Audit ${id} failed: ${(err as Error).message}`);
      const reloaded = await this.model.findById(id);
      if (reloaded && reloaded.status !== 'completed') {
        reloaded.status = 'failed';
        reloaded.error = (err as Error).message?.slice(0, 500);
        reloaded.completedAt = new Date();
        await reloaded.save();
      }
    }
  }

  private async runPipeline(doc: SiteAuditDocument): Promise<void> {
    const url = doc.normalizedUrl;
    const parsed = new URL(url);
    const origin = `${parsed.protocol}//${parsed.host}`;

    // -------- Probes (all isolated; one failure / hang cannot crash the rest) --------
    const T = SiteAuditService;
    const [homepage, screenshotUrl, sitemap, whois, ssl, mobilePS, desktopPS] =
      await Promise.all([
        this.withTimeout('homepage', T.TIMEOUT_HOMEPAGE_MS, () => this.fetcher.fetch(url)),
        this.withTimeout('screenshot', T.TIMEOUT_SCREENSHOT_MS, () => this.screenshot.capture(url)),
        this.withTimeout('sitemap', T.TIMEOUT_SITEMAP_MS, () => this.sitemap.scan(origin)),
        this.withTimeout('whois', T.TIMEOUT_WHOIS_MS, () => this.whois.lookup(parsed.hostname)),
        this.withTimeout('ssl', T.TIMEOUT_SSL_MS, () => this.runSsl(url)),
        this.withTimeout('pagespeed-mobile', T.TIMEOUT_PAGESPEED_MS, () => this.pageSpeed.run(url, 'mobile')),
        this.withTimeout('pagespeed-desktop', T.TIMEOUT_PAGESPEED_MS, () => this.pageSpeed.run(url, 'desktop')),
      ]);

    doc.screenshotUrl = screenshotUrl ?? undefined;
    if (homepage) {
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
    }
    doc.findings.pageSpeed = { mobile: mobilePS, desktop: desktopPS };
    doc.findings.whois = whois;
    doc.findings.ssl = ssl;

    let homepageText = '';
    const headersForAi = homepage?.headers ?? {};
    const htmlHead = homepage?.body ? homepage.body.slice(0, 5000) : '';

    if (homepage?.ok && homepage.body) {
      const analyzed = this.html.analyze({
        url,
        body: homepage.body,
        headers: homepage.headers,
      });
      if (doc.findings.homepage) {
        doc.findings.homepage.title = analyzed.title;
        doc.findings.homepage.language = analyzed.language;
      }
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

    if (sitemap) {
      doc.findings.sitemap = sitemap.sitemap;
      doc.findings.robots = sitemap.robots;
    }
    doc.markModified('findings');
    await doc.save();

    // -------- AI layer (each task isolated) --------
    if (this.ai.isReady) {
      await this.runAi(
        doc,
        headersForAi,
        htmlHead,
        sitemap?.sampleUrls ?? [],
        homepageText,
      );
    }
  }

  /**
   * Race a step against a hard external timeout. Resolves with undefined
   * if the step throws OR if it takes longer than `ms`. The inner promise
   * may keep running (we can't truly cancel an arbitrary fetch from the
   * outside) but we never block the audit waiting for it.
   */
  private async withTimeout<T>(
    label: string,
    ms: number,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<undefined>((resolve) => {
      timer = setTimeout(() => {
        this.logger.warn(`Probe "${label}" hit external ${ms}ms cap, moving on`);
        resolve(undefined);
      }, ms);
    });
    try {
      const result = await Promise.race([
        fn().catch((err) => {
          this.logger.warn(`Probe "${label}" threw: ${(err as Error).message}`);
          return undefined as unknown as T;
        }),
        timeout,
      ]);
      return result;
    } finally {
      if (timer) clearTimeout(timer);
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
    const T = SiteAuditService;

    // Sample interior pages for content analysis. Parallel + capped so a
    // single slow page can't budget the entire AI section.
    const interiorUrls = sampleUrls
      .filter((u) => u !== doc.normalizedUrl && !u.endsWith('/'))
      .slice(0, 2);
    const interiorResults = await Promise.all(
      interiorUrls.map((u) =>
        this.withTimeout('interior-page', T.TIMEOUT_INTERIOR_FETCH_MS, () =>
          this.fetcher.fetch(u, T.TIMEOUT_INTERIOR_FETCH_MS),
        ),
      ),
    );
    const interior = interiorResults
      .map((res, i) =>
        res && res.ok && res.body
          ? { url: interiorUrls[i], text: this.html.extractTextSample(res.body, 1500) }
          : null,
      )
      .filter((x): x is { url: string; text: string } => x !== null);

    // Each task is fully isolated. Whichever finishes first writes its
    // own field + persists immediately so a later failure (or the
    // wall-clock) can't blank out work that already succeeded.
    const persist = async (field: keyof typeof ai, value: unknown) => {
      (ai as Record<string, unknown>)[field] = value;
      doc.markModified('ai');
      try {
        await doc.save();
      } catch (e) {
        this.logger.warn(`ai save failed: ${(e as Error).message}`);
      }
    };

    const maybePersist = async (
      field: keyof typeof ai,
      value: unknown,
    ): Promise<void> => {
      if (value) await persist(field, value);
    };

    const tasks: Promise<void>[] = [
      this.withTimeout('ai:exec', T.TIMEOUT_AI_TEXT_MS, () =>
        this.ai.executiveSummary(doc.findings, homepageText),
      ).then((v) => maybePersist('executiveSummary', v)),
      this.withTimeout('ai:stack', T.TIMEOUT_AI_TEXT_MS, () =>
        this.ai.stackReasoning(doc.findings, headers, htmlHead),
      ).then((v) => maybePersist('stackReasoning', v)),
      this.withTimeout('ai:content', T.TIMEOUT_AI_TEXT_MS, () =>
        this.ai.contentAnalysis(homepageText, interior),
      ).then((v) => maybePersist('contentAnalysis', v)),
    ];
    if (doc.screenshotUrl) {
      tasks.push(
        this.withTimeout('ai:visual', T.TIMEOUT_AI_VISION_MS, () =>
          this.ai.visualCritique(doc.screenshotUrl!),
        ).then((v) => maybePersist('visualCritique', v)),
      );
    }

    await Promise.allSettled(tasks);

    // Line items depends on the executive summary, so it runs last.
    const items = await this.withTimeout('ai:items', T.TIMEOUT_AI_TEXT_MS, () =>
      this.ai.suggestedLineItems(doc.findings, ai.executiveSummary ?? ''),
    );
    await maybePersist('suggestedLineItems', items);

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
