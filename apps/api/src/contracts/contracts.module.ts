import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ProjectsModule } from '../projects/projects.module';
import { ServicesModule } from '../services/services.module';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { Contract, ContractSchema } from './schemas/contract.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Contract.name, schema: ContractSchema }]),
    ProjectsModule,
    ServicesModule,
  ],
  controllers: [ContractsController],
  providers: [ContractsService],
  exports: [ContractsService],
})
export class ContractsModule {}
