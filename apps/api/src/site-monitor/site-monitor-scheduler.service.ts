import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { SiteMonitorService } from './site-monitor.service';

@Injectable()
export class SiteMonitorSchedulerService {
  private readonly logger = new Logger(SiteMonitorSchedulerService.name);

  constructor(private readonly monitorService: SiteMonitorService) {}

  /** HTTP probe every 5 minutes; SSL is refreshed once per 24h within the
   *  same sweep to avoid a separate handshake storm. */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async http() {
    try {
      await this.monitorService.runHttpSweep();
    } catch (err) {
      this.logger.error(`HTTP sweep failed: ${(err as Error).message}`);
    }
  }
}
