import { Module } from '@nestjs/common';
import { EstimatesModule } from '../estimates/estimates.module';
import { ProjectsModule } from '../projects/projects.module';
import { PublicController } from './public.controller';
import { PublicService } from './public.service';

@Module({
  imports: [EstimatesModule, ProjectsModule],
  controllers: [PublicController],
  providers: [PublicService],
})
export class PublicModule {}
