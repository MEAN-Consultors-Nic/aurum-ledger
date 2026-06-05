import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Client, ClientSchema } from '../clients/schemas/client.schema';
import { Contract, ContractSchema } from '../contracts/schemas/contract.schema';
import { Estimate, EstimateSchema } from '../estimates/schemas/estimate.schema';
import {
  ProjectTask,
  ProjectTaskSchema,
} from '../projects/schemas/project-task.schema';
import { Project, ProjectSchema } from '../projects/schemas/project.schema';
import { Service, ServiceSchema } from '../services/schemas/service.schema';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Client.name, schema: ClientSchema },
      { name: Estimate.name, schema: EstimateSchema },
      { name: Contract.name, schema: ContractSchema },
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectTask.name, schema: ProjectTaskSchema },
      { name: Service.name, schema: ServiceSchema },
    ]),
  ],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
