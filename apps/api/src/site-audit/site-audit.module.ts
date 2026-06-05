import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Estimate, EstimateSchema } from '../estimates/schemas/estimate.schema';
import { SiteMonitorModule } from '../site-monitor/site-monitor.module';
import { AiAnalystService } from './ai-analyst.service';
import { OpenAiService } from './openai/openai.service';
import { FetcherService } from './probes/fetcher.service';
import { HtmlAnalyzer } from './probes/html-analyzer.service';
import { PageSpeedService } from './probes/pagespeed.service';
import { ScreenshotService } from './probes/screenshot.service';
import { SitemapScanner } from './probes/sitemap-scanner.service';
import { WhoisService } from './probes/whois.service';
import { SiteAudit, SiteAuditSchema } from './schemas/site-audit.schema';
import { SiteAuditController } from './site-audit.controller';
import { SiteAuditService } from './site-audit.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SiteAudit.name, schema: SiteAuditSchema },
      // Used directly when converting an audit into a draft estimate.
      { name: Estimate.name, schema: EstimateSchema },
    ]),
    SiteMonitorModule,
  ],
  controllers: [SiteAuditController],
  providers: [
    SiteAuditService,
    FetcherService,
    HtmlAnalyzer,
    PageSpeedService,
    SitemapScanner,
    WhoisService,
    ScreenshotService,
    OpenAiService,
    AiAnalystService,
  ],
})
export class SiteAuditModule {}
