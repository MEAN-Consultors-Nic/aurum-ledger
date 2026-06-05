import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import {
  VaultAccessLog,
  VaultAccessLogSchema,
} from './schemas/vault-access-log.schema';
import { VaultEntry, VaultEntrySchema } from './schemas/vault-entry.schema';
import { VaultController } from './vault.controller';
import { VaultService } from './vault.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: VaultEntry.name, schema: VaultEntrySchema },
      { name: VaultAccessLog.name, schema: VaultAccessLogSchema },
    ]),
  ],
  controllers: [VaultController],
  providers: [VaultService, CredentialCipher],
})
export class VaultModule {}
