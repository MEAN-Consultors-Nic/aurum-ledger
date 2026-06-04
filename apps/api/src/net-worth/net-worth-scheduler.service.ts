import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { NetWorthService } from './net-worth.service';

@Injectable()
export class NetWorthSchedulerService {
  private readonly logger = new Logger(NetWorthSchedulerService.name);

  constructor(private readonly netWorthService: NetWorthService) {}

  // 02:00 UTC daily — gives txn writes during the day plenty of settle time.
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async daily() {
    try {
      const payload = await this.netWorthService.snapshot();
      this.logger.log(`daily snapshot ${payload.dateKey} ok`);
    } catch (err) {
      this.logger.error(`daily snapshot failed: ${(err as Error).message}`);
    }
  }
}
