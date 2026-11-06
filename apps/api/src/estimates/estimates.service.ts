import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, SortOrder, Types } from 'mongoose';
import { ContractsService } from '../contracts/contracts.service';
import { ConvertEstimateDto } from './dto/convert-estimate.dto';
import { CreateEstimateDto } from './dto/create-estimate.dto';
import { FilterEstimateDto } from './dto/filter-estimate.dto';
import { UpdateEstimateDto } from './dto/update-estimate.dto';
import { Estimate, EstimateDocument } from './schemas/estimate.schema';
import {
  MAX_PIN_ATTEMPTS,
  canShareStatus,
  generatePin,
  hashPin,
  linkExpiresAt,
  shareLinkState,
} from './share-link';

@Injectable()
export class EstimatesService {
  constructor(
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
    private readonly contractsService: ContractsService,
  ) {}

  async create(dto: CreateEstimateDto, userId?: Types.ObjectId) {
    return this.estimateModel.create({
      ...dto,
      clientId: new Types.ObjectId(dto.clientId),
      serviceId: new Types.ObjectId(dto.serviceId),
      currency: dto.currency ?? 'USD',
      status: dto.status ?? 'draft',
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async findAll(filter: FilterEstimateDto) {
    const page = Math.max(Number(filter.page) || 1, 1);
    const limit = Math.min(Math.max(Number(filter.limit) || 20, 1), 100);
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };

    if (filter.clientId) {
      query.clientId = new Types.ObjectId(filter.clientId);
    }

    if (filter.status) {
      query.status = filter.status;
    }

    if (filter.search) {
      query.$or = [{ title: { $regex: filter.search, $options: 'i' } }];
    }

    const sort: Record<string, SortOrder> = { createdAt: -1 };

    const [items, total] = await Promise.all([
      this.estimateModel
        .find(query)
        .populate('clientId', 'name')
        .populate('serviceId', 'name')
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit),
      this.estimateModel.countDocuments(query),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    })
      .populate('clientId', 'name')
      .populate('serviceId', 'name');

    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }

    return estimate;
  }

  async update(id: string, dto: UpdateEstimateDto, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (estimate.status === 'converted') {
      throw new BadRequestException('Converted estimates cannot be updated');
    }

    const { clientId, serviceId, validUntil, ...restDto } = dto;
    const payload: Partial<Estimate> = {
      ...restDto,
      updatedBy: userId,
    };

    if (clientId) {
      payload.clientId = new Types.ObjectId(clientId);
    }
    if (serviceId) {
      payload.serviceId = new Types.ObjectId(serviceId);
    }
    if (validUntil !== undefined) {
      payload.validUntil = validUntil ? new Date(validUntil) : undefined;
    }

    const updated = await this.estimateModel.findByIdAndUpdate(id, payload, { new: true });
    if (!updated) {
      throw new NotFoundException('Estimate not found');
    }
    return updated;
  }

  async softDelete(id: string, userId?: Types.ObjectId) {
    const existing = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!existing) {
      throw new NotFoundException('Estimate not found');
    }
    if (existing.status === 'converted') {
      throw new BadRequestException(
        'Converted estimates cannot be deleted because they are linked to an existing contract',
      );
    }
    existing.deletedAt = new Date();
    existing.updatedBy = userId;
    await existing.save();
    return existing;
  }

  async convertToContract(id: string, dto: ConvertEstimateDto, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (estimate.status === 'converted') {
      throw new BadRequestException('Estimate is already converted');
    }
    if (estimate.status === 'rejected' || estimate.status === 'expired') {
      throw new BadRequestException('Estimate cannot be converted from current status');
    }

    const contractNotesBase = dto.contractNotes ?? estimate.notes;
    const contractNotes = dto.conversionNotes
      ? [contractNotesBase, `Conversion: ${dto.conversionNotes}`].filter(Boolean).join('\n')
      : contractNotesBase;

    const contract = await this.contractsService.create(
      {
        clientId: estimate.clientId.toString(),
        serviceId: estimate.serviceId.toString(),
        title: estimate.title,
        billingPeriod: dto.billingPeriod ?? estimate.billingPeriod,
        amount: dto.amount ?? estimate.amount,
        currency: dto.currency ?? estimate.currency ?? 'USD',
        startDate: dto.startDate,
        endDate: dto.endDate,
        notes: contractNotes,
        createProject: dto.createProject,
        createGithubRepo: dto.createGithubRepo,
      },
      userId,
    );

    const updatedEstimate = await this.estimateModel.findByIdAndUpdate(
      estimate._id,
      {
        status: 'converted',
        convertedAt: new Date(),
        convertedBy: userId,
        convertedContractId: contract._id,
        conversionNotes: dto.conversionNotes,
        updatedBy: userId,
      },
      { new: true },
    );

    if (!updatedEstimate) {
      throw new NotFoundException('Estimate not found');
    }

    return { estimate: updatedEstimate, contract };
  }

  // ------------------------------------------------------------
  // Client-portal share link
  // ------------------------------------------------------------

  /**
   * Creates the estimate's client link and its PIN. Any previous link and
   * PIN stop working, wrong-PIN attempts reset, and a previous client answer
   * is kept on the estimate (it is history) but the new link starts fresh.
   * The PIN is returned ONLY here; Helm keeps just its hash.
   * Sharing a draft marks it as sent.
   */
  async generateShareToken(id: string, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    if (!canShareStatus(estimate.status)) {
      throw new BadRequestException(
        `A client link can only be created for draft or sent estimates (this one is ${estimate.status}).`,
      );
    }
    const pin = generatePin();
    const now = new Date();
    estimate.shareToken = randomBytes(32).toString('base64url');
    estimate.sharePinHash = hashPin(pin);
    estimate.shareCreatedAt = now;
    estimate.shareCreatedBy = userId;
    estimate.shareRevokedAt = undefined;
    estimate.shareViewCount = 0;
    estimate.shareLastViewedAt = undefined;
    estimate.shareFailedAttempts = 0;
    estimate.shareLockedAt = undefined;
    estimate.clientDecision = undefined;
    estimate.clientDecisionAt = undefined;
    estimate.clientDecisionName = undefined;
    estimate.clientDecisionReason = undefined;
    estimate.clientDecisionIp = undefined;
    estimate.clientDecisionUserAgent = undefined;
    estimate.clientAcceptedTerms = undefined;
    estimate.clientDecisionSnapshot = undefined;
    if (estimate.status === 'draft') {
      estimate.status = 'sent';
      estimate.sentAt = now;
      estimate.sentBy = userId;
    }
    estimate.updatedBy = userId;
    await estimate.save();
    return { ...this.shareSummary(estimate), pin };
  }

  /** The link's state for the Helm user (never the PIN or its hash). */
  async getShareStatus(id: string) {
    const estimate = await this.estimateModel
      .findOne({ _id: id, deletedAt: { $exists: false } })
      .select('+sharePinHash');
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    return this.shareSummary(estimate);
  }

  private shareSummary(e: EstimateDocument) {
    return {
      status: e.status,
      shareToken: e.shareToken,
      shareCreatedAt: e.shareCreatedAt,
      shareRevokedAt: e.shareRevokedAt,
      shareViewCount: e.shareViewCount ?? 0,
      shareLastViewedAt: e.shareLastViewedAt,
      shareFailedAttempts: e.shareFailedAttempts ?? 0,
      shareLockedAt: e.shareLockedAt,
      // Links made before PINs existed have no hash and cannot be opened.
      hasPin: !!e.sharePinHash,
      linkState: e.shareToken ? shareLinkState(e) : null,
      expiresAt: linkExpiresAt(e.validUntil),
      clientDecision: e.clientDecision,
      clientDecisionAt: e.clientDecisionAt,
      clientDecisionName: e.clientDecisionName,
      clientDecisionReason: e.clientDecisionReason,
      clientDecisionIp: e.clientDecisionIp,
      clientDecisionSnapshot: e.clientDecisionSnapshot,
    };
  }

  async revokeShareToken(id: string, userId?: Types.ObjectId) {
    const estimate = await this.estimateModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!estimate) {
      throw new NotFoundException('Estimate not found');
    }
    estimate.shareRevokedAt = new Date();
    estimate.updatedBy = userId;
    await estimate.save();
    return { revoked: true };
  }

  /**
   * The estimate behind a public link, with its PIN hash, WITHOUT counting a
   * view. 404 for unknown or deleted links; revoked/locked/expired links are
   * found so the page can say why they do not open.
   */
  async findByShareToken(token: string) {
    if (!token || token.length > 100) {
      throw new NotFoundException('This link is no longer valid');
    }
    const estimate = await this.estimateModel
      .findOne({ shareToken: token, deletedAt: { $exists: false } })
      .select('+sharePinHash')
      .populate('clientId', 'name email')
      .populate('serviceId', 'name');
    if (!estimate) {
      throw new NotFoundException('This link is no longer valid');
    }
    return estimate;
  }

  /**
   * Counts one wrong PIN. Returns the attempts left, and `lockedNow` exactly
   * once — when this attempt is the one that locks the link (conditional
   * update, so concurrent guesses cannot lock it twice or skip the lock).
   */
  async recordWrongPin(estimateId: Types.ObjectId, token: string) {
    const updated = await this.estimateModel.findOneAndUpdate(
      { _id: estimateId, shareToken: token, shareLockedAt: { $exists: false } },
      { $inc: { shareFailedAttempts: 1 } },
      { new: true },
    );
    const attempts = updated?.shareFailedAttempts ?? MAX_PIN_ATTEMPTS;
    let lockedNow = false;
    if (attempts >= MAX_PIN_ATTEMPTS) {
      const lock = await this.estimateModel.updateOne(
        {
          _id: estimateId,
          shareToken: token,
          shareLockedAt: { $exists: false },
        },
        { $set: { shareLockedAt: new Date() } },
      );
      lockedNow = lock.modifiedCount === 1;
    }
    return {
      attemptsLeft: Math.max(0, MAX_PIN_ATTEMPTS - attempts),
      lockedNow,
    };
  }

  /** A correct PIN opened the link: count the view, forget earlier misses. */
  async recordView(estimateId: Types.ObjectId, token: string) {
    await this.estimateModel.updateOne(
      { _id: estimateId, shareToken: token },
      {
        $inc: { shareViewCount: 1 },
        $set: { shareLastViewedAt: new Date(), shareFailedAttempts: 0 },
      },
    );
  }

  /**
   * Records the client's answer. Atomic: it only applies while the link is
   * still the same, not revoked or locked, the estimate is still draft/sent
   * and nobody answered yet — so a double click or a race answers once.
   */
  async recordClientDecision(
    estimate: EstimateDocument,
    token: string,
    answer: {
      decision: 'accepted' | 'declined';
      name?: string;
      reason?: string;
      acceptedTerms?: boolean;
      ip: string;
      userAgent: string;
    },
  ) {
    const now = new Date();
    const result = await this.estimateModel.updateOne(
      {
        _id: estimate._id,
        shareToken: token,
        shareRevokedAt: { $exists: false },
        shareLockedAt: { $exists: false },
        clientDecision: { $exists: false },
        status: { $in: ['draft', 'sent'] },
        deletedAt: { $exists: false },
      },
      {
        $set: {
          status: answer.decision === 'accepted' ? 'accepted' : 'rejected',
          clientDecision: answer.decision,
          clientDecisionAt: now,
          ...(answer.name ? { clientDecisionName: answer.name } : {}),
          ...(answer.reason ? { clientDecisionReason: answer.reason } : {}),
          ...(answer.acceptedTerms ? { clientAcceptedTerms: true } : {}),
          clientDecisionIp: answer.ip,
          clientDecisionUserAgent: answer.userAgent.slice(0, 300),
          clientDecisionSnapshot: {
            title: estimate.title,
            amount: estimate.amount,
            currency: estimate.currency,
            billingPeriod: estimate.billingPeriod,
          },
        },
      },
    );
    return result.modifiedCount === 1 ? now : null;
  }
}
