import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateCustomFieldDto } from './dto/create-custom-field.dto';
import { UpdateCustomFieldDto } from './dto/update-custom-field.dto';
import {
  CustomField,
  CustomFieldDocument,
  CustomFieldEntityType,
} from './schemas/custom-field.schema';

@Injectable()
export class CustomFieldsService {
  constructor(
    @InjectModel(CustomField.name)
    private readonly fieldModel: Model<CustomFieldDocument>,
  ) {}

  async list(entityType?: CustomFieldEntityType) {
    const filter: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (entityType) filter.entityType = entityType;
    return this.fieldModel.find(filter).sort({ entityType: 1, order: 1, label: 1 });
  }

  async activeFor(entityType: CustomFieldEntityType) {
    return this.fieldModel
      .find({ entityType, active: true, deletedAt: { $exists: false } })
      .sort({ order: 1, label: 1 });
  }

  async create(dto: CreateCustomFieldDto, userId?: Types.ObjectId) {
    const cleanKey = this.normalizeKey(dto.key);
    const exists = await this.fieldModel.findOne({
      entityType: dto.entityType,
      key: cleanKey,
      deletedAt: { $exists: false },
    });
    if (exists) {
      throw new ConflictException(
        `A field with key '${cleanKey}' already exists for ${dto.entityType}`,
      );
    }
    if (dto.type === 'select' && (!dto.options || dto.options.length === 0)) {
      throw new BadRequestException('Select fields require at least one option');
    }
    return this.fieldModel.create({
      ...dto,
      key: cleanKey,
      options: dto.options ?? [],
      active: dto.active ?? true,
      order: dto.order ?? 0,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async update(id: string, dto: UpdateCustomFieldDto, userId?: Types.ObjectId) {
    const existing = await this.fieldModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!existing) throw new NotFoundException('Field not found');
    const nextType = dto.type ?? existing.type;
    const nextOptions = dto.options ?? existing.options;
    if (nextType === 'select' && (!nextOptions || nextOptions.length === 0)) {
      throw new BadRequestException('Select fields require at least one option');
    }
    Object.assign(existing, dto, { updatedBy: userId });
    await existing.save();
    return existing;
  }

  async remove(id: string, userId?: Types.ObjectId) {
    const field = await this.fieldModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!field) throw new NotFoundException('Field not found');
    return field;
  }

  /**
   * Validates and coerces a `customValues` object against the active
   * definitions for the given entity. Returns a cleaned object containing
   * only known fields with the correct types. Unknown keys are dropped
   * (forward-compat: deleted definitions leave silent values until they're
   * either re-added or rewritten by an update).
   */
  async validateValues(
    entityType: CustomFieldEntityType,
    incoming: Record<string, unknown> | undefined,
  ): Promise<Record<string, unknown>> {
    if (incoming === undefined || incoming === null) return {};
    if (typeof incoming !== 'object') {
      throw new BadRequestException('customValues must be an object');
    }
    const defs = await this.activeFor(entityType);
    const result: Record<string, unknown> = {};
    for (const def of defs) {
      const raw = (incoming as Record<string, unknown>)[def.key];
      if (raw === undefined || raw === null || raw === '') {
        if (def.required) {
          throw new BadRequestException(`Custom field '${def.label}' is required`);
        }
        continue;
      }
      switch (def.type) {
        case 'text':
        case 'textarea':
          result[def.key] = String(raw);
          break;
        case 'number': {
          const n = Number(raw);
          if (!Number.isFinite(n)) {
            throw new BadRequestException(`'${def.label}' must be a number`);
          }
          result[def.key] = n;
          break;
        }
        case 'boolean':
          result[def.key] = raw === true || raw === 'true' || raw === 1 || raw === '1';
          break;
        case 'date': {
          const d = new Date(String(raw));
          if (Number.isNaN(d.getTime())) {
            throw new BadRequestException(`'${def.label}' must be a valid date`);
          }
          result[def.key] = d;
          break;
        }
        case 'select': {
          const value = String(raw);
          if (!def.options.includes(value)) {
            throw new BadRequestException(
              `'${def.label}' value must be one of: ${def.options.join(', ')}`,
            );
          }
          result[def.key] = value;
          break;
        }
        case 'url': {
          const value = String(raw);
          try {
            new URL(value);
          } catch {
            throw new BadRequestException(`'${def.label}' must be a valid URL`);
          }
          result[def.key] = value;
          break;
        }
      }
    }
    return result;
  }

  /** lower-snake-case, alphanumeric. Stable identity for storage. */
  private normalizeKey(input: string): string {
    return (input || '')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 60);
  }
}
