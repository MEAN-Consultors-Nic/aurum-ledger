import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import { Category, CategorySchema } from '../categories/schemas/category.schema';
import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { Setting, SettingSchema } from './schemas/setting.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Setting.name, schema: SettingSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [SettingsController],
  providers: [SettingsService, CredentialCipher],
  exports: [SettingsService],
})
export class SettingsModule {}
