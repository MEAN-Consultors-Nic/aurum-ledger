import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { GithubModule } from '../github/github.module';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { SettingsModule } from '../settings/settings.module';
import { ProjectCredentialsService } from './project-credentials.service';
import { ProjectHandoverService } from './project-handover.service';
import { ProjectTasksService } from './project-tasks.service';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { Project, ProjectSchema } from './schemas/project.schema';
import {
  ProjectCredential,
  ProjectCredentialSchema,
} from './schemas/project-credential.schema';
import { ProjectTask, ProjectTaskSchema } from './schemas/project-task.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectTask.name, schema: ProjectTaskSchema },
      { name: ProjectCredential.name, schema: ProjectCredentialSchema },
      // Read-only refs used by the handover PDF generator.
      { name: Client.name, schema: ClientSchema },
      { name: Service.name, schema: ServiceSchema },
      { name: Contract.name, schema: ContractSchema },
    ]),
    GithubModule,
    SettingsModule,
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectTasksService,
    ProjectCredentialsService,
    ProjectHandoverService,
    CredentialCipher,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
