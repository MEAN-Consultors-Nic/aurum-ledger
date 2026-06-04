import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ClientsModule } from '../clients/clients.module';
import { ContractsModule } from '../contracts/contracts.module';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { PlannedIncomeOccurrence, PlannedIncomeOccurrenceSchema } from '../planned-incomes/schemas/planned-income-occurrence.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { ProjectTask, ProjectTaskSchema } from '../projects/schemas/project-task.schema';
import { ProjectsModule } from '../projects/projects.module';
import { UsersModule } from '../users/users.module';
import { NotificationsEngineController } from './notifications-engine.controller';
import { NotificationsEngineService } from './notifications-engine.service';
import { NotificationsSchedulerService } from './notifications-scheduler.service';
import { NotificationLog, NotificationLogSchema } from './schemas/log.schema';
import { NotificationRule, NotificationRuleSchema } from './schemas/rule.schema';
import {
  NotificationTemplate,
  NotificationTemplateSchema,
} from './schemas/template.schema';
import { TemplateGroup, TemplateGroupSchema } from './schemas/template-group.schema';
import { TemplateRendererService } from './template-renderer.service';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    MongooseModule.forFeature([
      { name: TemplateGroup.name, schema: TemplateGroupSchema },
      { name: NotificationTemplate.name, schema: NotificationTemplateSchema },
      { name: NotificationRule.name, schema: NotificationRuleSchema },
      { name: NotificationLog.name, schema: NotificationLogSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectTask.name, schema: ProjectTaskSchema },
      { name: PlannedIncomeOccurrence.name, schema: PlannedIncomeOccurrenceSchema },
    ]),
    UsersModule,
    ClientsModule,
    ProjectsModule,
    ContractsModule,
  ],
  controllers: [NotificationsEngineController],
  providers: [
    TemplateRendererService,
    NotificationsEngineService,
    NotificationsSchedulerService,
  ],
})
export class NotificationsEngineModule {}
