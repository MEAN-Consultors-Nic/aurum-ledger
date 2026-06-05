import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateSiteMonitorDto } from './dto/create-site-monitor.dto';
import { UpdateSiteMonitorDto } from './dto/update-site-monitor.dto';
import { SiteMonitor, SiteMonitorDocument } from './schemas/site-monitor.schema';
import { SiteMonitorChecker } from './site-monitor-checker.service';

@Injectable()
export class SiteMonitorService {
  private readonly logger = new Logger(SiteMonitorService.name);

  constructor(
    @InjectModel(SiteMonitor.name)
    private readonly monitorModel: Model<SiteMonitorDocument>,
    private readonly checker: SiteMonitorChecker,
  ) {}

  async list() {
    return this.monitorModel
      .find({ deletedAt: { $exists: false } })
      .populate('projectId', 'name')
      .sort({ isActive: -1, name: 1 });
  }

  async findById(id: string) {
    const monitor = await this.monitorModel
      .findOne({ _id: id, deletedAt: { $exists: false } })
      .populate('projectId', 'name');
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }

  async create(dto: CreateSiteMonitorDto, userId?: Types.ObjectId) {
    return this.monitorModel.create({
      ...dto,
      projectId: dto.projectId ? new Types.ObjectId(dto.projectId) : undefined,
      domainExpiresAt: dto.domainExpiresAt ? new Date(dto.domainExpiresAt) : undefined,
      isActive: dto.isActive ?? true,
      isUp: true,
      createdBy: userId,
      updatedBy: userId,
    });
  }

  async update(id: string, dto: UpdateSiteMonitorDto, userId?: Types.ObjectId) {
    const update: Record<string, unknown> = { ...dto, updatedBy: userId };
    if (dto.projectId !== undefined) {
      update.projectId = dto.projectId ? new Types.ObjectId(dto.projectId) : null;
    }
    if (dto.domainExpiresAt !== undefined) {
      update.domainExpiresAt = dto.domainExpiresAt
        ? new Date(dto.domainExpiresAt)
        : null;
    }
    const monitor = await this.monitorModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      update,
      { new: true },
    );
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }

  async remove(id: string, userId?: Types.ObjectId) {
    const monitor = await this.monitorModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!monitor) throw new NotFoundException('Monitor not found');
    return monitor;
  }

  /** Runs HTTP + SSL checks for one monitor and persists results. */
  async checkNow(id: string) {
    const monitor = await this.monitorModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!monitor) throw new NotFoundException('Monitor not found');
    await this.runChecks(monitor);
    return monitor;
  }

  /** Sweeps all active monitors and runs HTTP probe. SSL check piggybacks
   *  if the previous SSL check is older than 24h. */
  async runHttpSweep() {
    const monitors = await this.monitorModel.find({
      isActive: true,
      deletedAt: { $exists: false },
    });
    const now = Date.now();
    await Promise.all(
      monitors.map(async (m) => {
        const sslStale =
          !m.sslCheckedAt ||
          now - m.sslCheckedAt.getTime() > 24 * 60 * 60 * 1000;
        await this.runChecks(m, { http: true, ssl: sslStale });
      }),
    );
  }

  async runSslSweep() {
    const monitors = await this.monitorModel.find({
      isActive: true,
      deletedAt: { $exists: false },
    });
    await Promise.all(monitors.map((m) => this.runChecks(m, { http: false, ssl: true })));
  }

  private async runChecks(
    monitor: SiteMonitorDocument,
    parts: { http?: boolean; ssl?: boolean } = { http: true, ssl: true },
  ) {
    const now = new Date();

    if (parts.http) {
      const result = await this.checker.http(monitor.url);
      monitor.lastCheckedAt = now;
      monitor.lastHttpStatus = result.status;
      monitor.lastResponseMs = result.responseMs;
      monitor.lastErrorMessage = result.error;
      const wasUp = monitor.isUp;
      monitor.isUp = result.isUp;
      if (!result.isUp && wasUp) {
        monitor.lastDownAt = now;
      }
    }

    if (parts.ssl && monitor.url.startsWith('https://')) {
      try {
        const ssl = await this.checker.ssl(monitor.url);
        monitor.sslExpiresAt = ssl.validTo;
        monitor.sslIssuer = ssl.issuer;
        monitor.sslCheckedAt = now;
      } catch (err) {
        this.logger.warn(
          `SSL check failed for ${monitor.name} (${monitor.url}): ${(err as Error).message}`,
        );
        monitor.sslCheckedAt = now;
      }
    }

    await monitor.save();
  }
}
