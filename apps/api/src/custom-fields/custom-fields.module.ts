import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CustomFieldsController } from './custom-fields.controller';
import { CustomFieldsService } from './custom-fields.service';
import { CustomField, CustomFieldSchema } from './schemas/custom-field.schema';

/**
 * Global so any entity service (Clients, Projects, ...) can inject
 * CustomFieldsService without each module importing CustomFieldsModule
 * explicitly.
 */
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CustomField.name, schema: CustomFieldSchema },
    ]),
  ],
  controllers: [CustomFieldsController],
  providers: [CustomFieldsService],
  exports: [CustomFieldsService],
})
export class CustomFieldsModule {}
