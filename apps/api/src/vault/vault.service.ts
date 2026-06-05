import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { CredentialCipher } from '../common/crypto/credential-cipher';
import { CreateVaultEntryDto, UpdateVaultEntryDto } from './dto/vault-entry.dto';
import {
  VaultAccessAction,
  VaultAccessLog,
  VaultAccessLogDocument,
} from './schemas/vault-access-log.schema';
import {
  VAULT_CATEGORIES,
  VaultCategory,
  VaultEntry,
  VaultEntryDocument,
} from './schemas/vault-entry.schema';

export type VaultEntryListItem = {
  _id: string;
  name: string;
  category: VaultCategory;
  tags: string[];
  url?: string;
  username?: string;
  notes?: string;
  parentType?: 'project' | 'client' | 'contract' | 'service' | null;
  parentId?: string | null;
  favorite: boolean;
  lastAccessedAt?: Date;
  accessCount: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type VaultEntryRevealed = VaultEntryListItem & {
  fields: Record<string, unknown>;
};

export type VaultCategoryCount = { category: VaultCategory | 'all'; count: number };

export type ListOptions = {
  q?: string;
  category?: VaultCategory;
  tag?: string;
  favorite?: boolean;
  parentType?: string;
  parentId?: string;
};

export type AccessContext = {
  userId?: Types.ObjectId;
  ip?: string;
  userAgent?: string;
};

@Injectable()
export class VaultService {
  constructor(
    @InjectModel(VaultEntry.name) private readonly entryModel: Model<VaultEntryDocument>,
    @InjectModel(VaultAccessLog.name)
    private readonly logModel: Model<VaultAccessLogDocument>,
    private readonly cipher: CredentialCipher,
  ) {}

  async list(opts: ListOptions): Promise<VaultEntryListItem[]> {
    const filter: FilterQuery<VaultEntryDocument> = { deletedAt: { $exists: false } };
    if (opts.category) filter.category = opts.category;
    if (opts.tag) filter.tags = opts.tag;
    if (opts.favorite) filter.favorite = true;
    if (opts.parentType) filter.parentType = opts.parentType;
    if (opts.parentId) filter.parentId = new Types.ObjectId(opts.parentId);
    if (opts.q) {
      const rx = new RegExp(this.escapeRegex(opts.q), 'i');
      filter.$or = [
        { name: rx },
        { url: rx },
        { username: rx },
        { notes: rx },
        { tags: rx },
      ];
    }

    const docs = await this.entryModel
      .find(filter)
      .sort({ favorite: -1, lastAccessedAt: -1, name: 1 })
      .limit(500)
      .lean();

    return docs.map((d) => this.toListItem(d));
  }

  async categoryCounts(): Promise<VaultCategoryCount[]> {
    const counts = await this.entryModel.aggregate<{ _id: VaultCategory; count: number }>([
      { $match: { deletedAt: { $exists: false } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const map = new Map(counts.map((c) => [c._id, c.count]));
    const total = counts.reduce((acc, c) => acc + c.count, 0);
    return [
      { category: 'all', count: total },
      ...VAULT_CATEGORIES.map((cat) => ({ category: cat, count: map.get(cat) ?? 0 })),
    ];
  }

  async findOne(id: string): Promise<VaultEntryListItem> {
    const doc = await this.entryModel
      .findOne({ _id: id, deletedAt: { $exists: false } })
      .lean();
    if (!doc) {
      throw new NotFoundException('Vault entry not found');
    }
    return this.toListItem(doc);
  }

  /**
   * Decrypt the secret bag and write an audit log row. This is the only
   * endpoint that ever returns plaintext fields.
   */
  async reveal(id: string, ctx: AccessContext): Promise<VaultEntryRevealed> {
    const doc = await this.entryModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      {
        $set: { lastAccessedAt: new Date(), lastAccessedBy: ctx.userId ?? null },
        $inc: { accessCount: 1 },
      },
      { new: true },
    );
    if (!doc) {
      throw new NotFoundException('Vault entry not found');
    }

    await this.writeLog(doc._id, 'view', ctx);

    let fields: Record<string, unknown> = {};
    try {
      fields = this.cipher.decrypt(doc.encryptedFields);
    } catch {
      fields = {
        __error: 'Unable to decrypt — encryption key may have changed',
      };
    }
    return { ...this.toListItem(doc.toObject()), fields };
  }

  async create(dto: CreateVaultEntryDto, ctx: AccessContext): Promise<VaultEntryListItem> {
    const encrypted = this.cipher.encrypt(dto.fields);
    const doc = await this.entryModel.create({
      name: dto.name,
      category: dto.category,
      tags: dto.tags ?? [],
      url: dto.url,
      username: dto.username,
      notes: dto.notes,
      encryptedFields: encrypted,
      parentType: dto.parentType ?? null,
      parentId: dto.parentId ? new Types.ObjectId(dto.parentId) : null,
      favorite: dto.favorite ?? false,
      createdBy: ctx.userId,
      updatedBy: ctx.userId,
    });
    await this.writeLog(doc._id, 'create', ctx);
    return this.toListItem(doc.toObject());
  }

  async update(
    id: string,
    dto: UpdateVaultEntryDto,
    ctx: AccessContext,
  ): Promise<VaultEntryListItem> {
    const doc = await this.entryModel.findOne({ _id: id, deletedAt: { $exists: false } });
    if (!doc) {
      throw new NotFoundException('Vault entry not found');
    }
    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.category !== undefined) doc.category = dto.category;
    if (dto.tags !== undefined) doc.tags = dto.tags;
    if (dto.url !== undefined) doc.url = dto.url;
    if (dto.username !== undefined) doc.username = dto.username;
    if (dto.notes !== undefined) doc.notes = dto.notes;
    if (dto.favorite !== undefined) doc.favorite = dto.favorite;
    if (dto.fields !== undefined) {
      doc.encryptedFields = this.cipher.encrypt(dto.fields);
    }
    doc.updatedBy = ctx.userId as any;
    await doc.save();
    await this.writeLog(doc._id, 'update', ctx);
    return this.toListItem(doc.toObject());
  }

  async remove(id: string, ctx: AccessContext) {
    const doc = await this.entryModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: ctx.userId },
      { new: true },
    );
    if (!doc) {
      throw new NotFoundException('Vault entry not found');
    }
    await this.writeLog(doc._id, 'delete', ctx);
    return { _id: doc._id.toString(), deleted: true };
  }

  async auditFor(id: string, limit = 25) {
    return this.logModel
      .find({ entryId: new Types.ObjectId(id) })
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100))
      .populate('userId', 'name email')
      .lean();
  }

  private async writeLog(
    entryId: Types.ObjectId,
    action: VaultAccessAction,
    ctx: AccessContext,
  ) {
    try {
      await this.logModel.create({
        entryId,
        userId: ctx.userId,
        action,
        ip: ctx.ip,
        userAgent: ctx.userAgent,
      });
    } catch {
      // Audit logging must never block the user from reading their own
      // secret. We log silently on failure.
    }
  }

  private toListItem(d: any): VaultEntryListItem {
    return {
      _id: d._id.toString(),
      name: d.name,
      category: d.category,
      tags: d.tags ?? [],
      url: d.url,
      username: d.username,
      notes: d.notes,
      parentType: d.parentType ?? null,
      parentId: d.parentId ? d.parentId.toString() : null,
      favorite: !!d.favorite,
      lastAccessedAt: d.lastAccessedAt,
      accessCount: d.accessCount ?? 0,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
    };
  }

  private escapeRegex(s: string) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}
