import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import { ProjectCredentialsService } from './project-credentials.service';
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
    ]),
  ],
  controllers: [ProjectsController],
  providers: [
    ProjectsService,
    ProjectTasksService,
    ProjectCredentialsService,
    CredentialCipher,
  ],
  exports: [ProjectsService],
})
export class ProjectsModule {}
