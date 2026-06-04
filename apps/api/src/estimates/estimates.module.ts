import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ContractsModule } from '../contracts/contracts.module';
import { EstimatesController } from './estimates.controller';
import { EstimatesService } from './estimates.service';
import { Estimate, EstimateSchema } from './schemas/estimate.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Estimate.name, schema: EstimateSchema }]),
    ContractsModule,
  ],
  controllers: [EstimatesController],
  providers: [EstimatesService],
  exports: [EstimatesService],
})
export class EstimatesModule {}
