import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SiteMonitor, SiteMonitorSchema } from './schemas/site-monitor.schema';
import { SiteMonitorChecker } from './site-monitor-checker.service';
import { SiteMonitorController } from './site-monitor.controller';
import { SiteMonitorSchedulerService } from './site-monitor-scheduler.service';
import { SiteMonitorService } from './site-monitor.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SiteMonitor.name, schema: SiteMonitorSchema },
    ]),
  ],
  controllers: [SiteMonitorController],
  providers: [SiteMonitorService, SiteMonitorChecker, SiteMonitorSchedulerService],
  exports: [SiteMonitorService],
})
export class SiteMonitorModule {}
