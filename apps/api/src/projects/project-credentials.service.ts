import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import { CreateCredentialDto, UpdateCredentialDto } from './dto/credential.dto';
import {
  ProjectCredential,
  ProjectCredentialDocument,
} from './schemas/project-credential.schema';

export type DecryptedCredential = {
  _id: string;
  projectId: string;
  type: string;
  name: string;
  fields: Record<string, unknown>;
  notes?: string;
  lastAccessedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
};

@Injectable()
export class ProjectCredentialsService {
  constructor(
    @InjectModel(ProjectCredential.name)
    private readonly credentialModel: Model<ProjectCredentialDocument>,
    private readonly cipher: CredentialCipher,
  ) {}

  async list(projectId: string): Promise<DecryptedCredential[]> {
    const items = await this.credentialModel
      .find({ projectId: new Types.ObjectId(projectId), deletedAt: { $exists: false } })
      .sort({ createdAt: 1 });
    return items.map((doc) => this.shape(doc));
  }

  async create(projectId: string, dto: CreateCredentialDto, userId?: Types.ObjectId) {
    const encrypted = this.cipher.encrypt(dto.fields);
    const doc = await this.credentialModel.create({
      projectId: new Types.ObjectId(projectId),
      type: dto.type,
      name: dto.name,
      notes: dto.notes,
      encryptedFields: encrypted,
      createdBy: userId,
      updatedBy: userId,
    });
    return this.shape(doc);
  }

  async update(credentialId: string, dto: UpdateCredentialDto, userId?: Types.ObjectId) {
    const existing = await this.credentialModel.findOne({
      _id: credentialId,
      deletedAt: { $exists: false },
    });
    if (!existing) {
      throw new NotFoundException('Credential not found');
    }

    if (dto.type !== undefined) existing.type = dto.type;
    if (dto.name !== undefined) existing.name = dto.name;
    if (dto.notes !== undefined) existing.notes = dto.notes;
    if (dto.fields !== undefined) {
      existing.encryptedFields = this.cipher.encrypt(dto.fields);
    }
    existing.updatedBy = userId as any;
    await existing.save();
    return this.shape(existing);
  }

  async remove(credentialId: string, userId?: Types.ObjectId) {
    const cred = await this.credentialModel.findOneAndUpdate(
      { _id: credentialId, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!cred) {
      throw new NotFoundException('Credential not found');
    }
    return { _id: cred._id.toString(), deleted: true };
  }

  async touchAccess(credentialId: string) {
    await this.credentialModel.updateOne(
      { _id: credentialId },
      { lastAccessedAt: new Date() },
    );
  }

  private shape(doc: ProjectCredentialDocument): DecryptedCredential {
    let fields: Record<string, unknown> = {};
    try {
      fields = this.cipher.decrypt(doc.encryptedFields);
    } catch (err) {
      fields = { __error: 'Unable to decrypt — encryption key may have changed' };
    }
    return {
      _id: doc._id.toString(),
      projectId: doc.projectId.toString(),
      type: doc.type,
      name: doc.name,
      fields,
      notes: doc.notes,
      lastAccessedAt: doc.lastAccessedAt,
      createdAt: (doc as any).createdAt,
      updatedAt: (doc as any).updatedAt,
    };
  }
}
