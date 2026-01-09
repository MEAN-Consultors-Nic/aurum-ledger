import { Module } from '@nestjs/common';
import { PlannedIncomesModule } from '../planned-incomes/planned-incomes.module';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [PlannedIncomesModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
})
export class NotificationsModule {}
