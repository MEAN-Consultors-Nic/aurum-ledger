import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MailerService } from '../mailer/mailer.service';
import { UsersService } from '../users/users.service';
import { ClientsService } from '../clients/clients.service';
import { ProjectsService } from '../projects/projects.service';
import { ContractsService } from '../contracts/contracts.service';
import { EstimatesService } from '../estimates/estimates.service';
import { EVENT_CATALOG, findEventByKey } from './event-catalog';
import { SEED_GROUPS, SEED_TEMPLATES } from './seed-templates';
import { ManualSendDto } from './dto/manual-send.dto';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { CreateTemplateGroupDto, UpdateTemplateGroupDto } from './dto/template-group.dto';
import {
  CreateTemplateDto,
  PreviewTemplateDto,
  TestSendDto,
  UpdateTemplateDto,
} from './dto/template.dto';
import { NotificationLog, NotificationLogDocument } from './schemas/log.schema';
import { NotificationRule, NotificationRuleDocument } from './schemas/rule.schema';
import { NotificationTemplate, NotificationTemplateDocument } from './schemas/template.schema';
import { TemplateGroup, TemplateGroupDocument } from './schemas/template-group.schema';
import { TemplateRendererService } from './template-renderer.service';

export type ResolvedRecipient = { expression: string; email: string };

@Injectable()
export class NotificationsEngineService implements OnModuleInit {
  private readonly logger = new Logger(NotificationsEngineService.name);

  constructor(
    @InjectModel(TemplateGroup.name)
    private readonly groupModel: Model<TemplateGroupDocument>,
    @InjectModel(NotificationTemplate.name)
    private readonly templateModel: Model<NotificationTemplateDocument>,
    @InjectModel(NotificationRule.name)
    private readonly ruleModel: Model<NotificationRuleDocument>,
    @InjectModel(NotificationLog.name)
    private readonly logModel: Model<NotificationLogDocument>,
    private readonly renderer: TemplateRendererService,
    private readonly mailer: MailerService,
    private readonly usersService: UsersService,
    private readonly clientsService: ClientsService,
    private readonly projectsService: ProjectsService,
    private readonly contractsService: ContractsService,
    private readonly estimatesService: EstimatesService,
  ) {}

  async onModuleInit() {
    await this.seedDefaults();
  }

  // ---------- Catalog (read-only) ----------
  getEventCatalog() {
    return EVENT_CATALOG;
  }

  // ---------- Groups ----------
  listGroups() {
    return this.groupModel
      .find({ deletedAt: { $exists: false } })
      .sort({ order: 1, name: 1 });
  }
  createGroup(dto: CreateTemplateGroupDto, userId?: Types.ObjectId) {
    return this.groupModel.create({ ...dto, createdBy: userId });
  }
  async updateGroup(id: string, dto: UpdateTemplateGroupDto) {
    const grp = await this.groupModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      dto,
      { new: true },
    );
    if (!grp) throw new NotFoundException('Group not found');
    return grp;
  }
  async deleteGroup(id: string) {
    const grp = await this.groupModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false }, isSystem: false },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!grp) throw new NotFoundException('Group not found or system-protected');
    return grp;
  }

  // ---------- Templates ----------
  listTemplates(filter: { groupId?: string; eventKey?: string } = {}) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.groupId) query.groupId = new Types.ObjectId(filter.groupId);
    if (filter.eventKey) query.eventKey = filter.eventKey;
    return this.templateModel
      .find(query)
      .populate('groupId', 'name color')
      .sort({ name: 1 });
  }
  async findTemplateById(id: string) {
    const tpl = await this.templateModel
      .findOne({ _id: id, deletedAt: { $exists: false } })
      .populate('groupId', 'name color');
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }
  createTemplate(dto: CreateTemplateDto, userId?: Types.ObjectId) {
    return this.templateModel.create({
      ...dto,
      groupId: dto.groupId ? new Types.ObjectId(dto.groupId) : undefined,
      createdBy: userId,
      updatedBy: userId,
    });
  }
  async updateTemplate(id: string, dto: UpdateTemplateDto, userId?: Types.ObjectId) {
    const tpl = await this.templateModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      {
        ...dto,
        groupId: dto.groupId ? new Types.ObjectId(dto.groupId) : undefined,
        updatedBy: userId,
      },
      { new: true },
    );
    if (!tpl) throw new NotFoundException('Template not found');
    return tpl;
  }
  async deleteTemplate(id: string) {
    const tpl = await this.templateModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false }, isSystem: false },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!tpl) throw new NotFoundException('Template not found or system-protected');
    return tpl;
  }

  preview(dto: PreviewTemplateDto) {
    const ctx = this.renderer.sampleContextFor(dto.eventKey);
    return this.renderer.render(
      { subject: dto.subject, bodyHtml: dto.bodyHtml, bodyText: dto.bodyText },
      ctx,
    );
  }

  async manualSend(dto: ManualSendDto, userId?: Types.ObjectId) {
    const tpl = await this.findTemplateById(dto.templateId);
    if (!tpl.isActive) {
      throw new BadRequestException('Template is inactive');
    }
    const built = await this.buildManualContext(dto.contextType, dto.contextId);
    const recipients = await this.resolveRecipients(dto.recipients, {
      contractId: built.contractId,
      projectId: built.projectId,
      clientId: built.clientId,
    });
    if (recipients.length === 0) {
      throw new BadRequestException(
        'No valid recipients resolved. The client may not have an email on file, or no admin/assignee exists.',
      );
    }
    const rendered = this.renderer.render(tpl, built.context);
    const results: Array<{ to: string; ok: boolean; error?: string }> = [];

    for (const recipient of recipients) {
      const result = await this.mailer.send({
        to: recipient.email,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      await this.logModel.create({
        eventKey: tpl.eventKey,
        templateId: tpl._id,
        contextRef: `${dto.contextType}:${dto.contextId}`,
        recipient: recipient.email,
        subject: rendered.subject,
        bodyHtml: rendered.html,
        status: result.ok ? 'sent' : 'failed',
        error: result.ok ? undefined : result.reason,
        sentAt: result.ok ? new Date() : undefined,
        triggeredBy: userId,
      });
      results.push({
        to: recipient.email,
        ok: result.ok,
        error: result.ok ? undefined : result.reason,
      });
    }
    return {
      sent: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private async buildManualContext(
    contextType: 'contract' | 'project' | 'client' | 'estimate',
    contextId: string,
  ): Promise<{
    context: Record<string, unknown>;
    contractId?: Types.ObjectId;
    projectId?: Types.ObjectId;
    clientId?: Types.ObjectId;
  }> {
    const DAY_MS = 24 * 60 * 60 * 1000;
    const now = new Date();
    if (contextType === 'contract') {
      const contract = (await this.contractsService.findById(contextId)) as any;
      const balance = contract.balance ?? contract.amount - (contract.paidTotal ?? 0);
      const endDate: Date | undefined = contract.endDate ? new Date(contract.endDate) : undefined;
      const daysOverdue = endDate && endDate < now ? Math.ceil((now.getTime() - endDate.getTime()) / DAY_MS) : 0;
      const daysUntilExpiry = endDate && endDate >= now ? Math.ceil((endDate.getTime() - now.getTime()) / DAY_MS) : 0;
      const clientObj = contract.clientId && typeof contract.clientId === 'object' ? contract.clientId : null;
      const serviceObj = contract.serviceId && typeof contract.serviceId === 'object' ? contract.serviceId : null;
      return {
        context: {
          client: clientObj ? { name: clientObj.name, email: clientObj.email } : { name: '(client)', email: '' },
          contract: {
            title: contract.title,
            amount: contract.amount,
            currency: contract.currency,
            startDate: contract.startDate,
            endDate: contract.endDate,
            billingPeriod: contract.billingPeriod,
          },
          service: serviceObj ? { name: serviceObj.name } : { name: '' },
          balance,
          daysOverdue,
          daysUntilExpiry,
        },
        contractId: (contract._id ?? new Types.ObjectId(contextId)) as Types.ObjectId,
        clientId: clientObj ? (clientObj._id as Types.ObjectId) : undefined,
      };
    }
    if (contextType === 'project') {
      const project = (await this.projectsService.findById(contextId)) as any;
      const dueDate: Date | undefined = project.dueDate ? new Date(project.dueDate) : undefined;
      const daysUntilDue = dueDate && dueDate >= now ? Math.ceil((dueDate.getTime() - now.getTime()) / DAY_MS) : 0;
      const clientObj = project.clientId && typeof project.clientId === 'object' ? project.clientId : null;
      return {
        context: {
          client: clientObj ? { name: clientObj.name, email: clientObj.email } : { name: '', email: '' },
          project: { name: project.name, dueDate: project.dueDate },
          daysUntilDue,
        },
        projectId: (project._id ?? new Types.ObjectId(contextId)) as Types.ObjectId,
        clientId: clientObj ? (clientObj._id as Types.ObjectId) : undefined,
      };
    }
    if (contextType === 'client') {
      const client = (await this.clientsService.findById(contextId)) as any;
      return {
        context: { client: { name: client.name, email: client.email } },
        clientId: client._id as Types.ObjectId,
      };
    }
    if (contextType === 'estimate') {
      const estimate = (await this.estimatesService.findById(contextId)) as any;
      if (!estimate) {
        throw new BadRequestException('Estimate not found');
      }
      const clientObj =
        estimate.clientId && typeof estimate.clientId === 'object' ? estimate.clientId : null;
      const serviceObj =
        estimate.serviceId && typeof estimate.serviceId === 'object' ? estimate.serviceId : null;
      const sentAt: Date | undefined = estimate.sentAt ? new Date(estimate.sentAt) : undefined;
      const daysSinceSent = sentAt
        ? Math.ceil((now.getTime() - sentAt.getTime()) / DAY_MS)
        : 0;
      return {
        context: {
          client: clientObj
            ? { name: clientObj.name, email: clientObj.email }
            : { name: '(client)', email: '' },
          estimate: {
            title: estimate.title,
            amount: estimate.amount,
            currency: estimate.currency,
            billingPeriod: estimate.billingPeriod,
            scope: estimate.scope,
            deliverables: estimate.deliverables ?? [],
            terms: estimate.terms,
            validUntil: estimate.validUntil,
            notes: estimate.notes,
          },
          service: serviceObj ? { name: serviceObj.name } : { name: '' },
          daysSinceSent,
        },
        clientId: clientObj ? (clientObj._id as Types.ObjectId) : undefined,
      };
    }
    throw new BadRequestException(`Unsupported contextType: ${contextType}`);
  }

  async testSend(templateId: string, dto: TestSendDto, userId?: Types.ObjectId) {
    const tpl = await this.findTemplateById(templateId);
    const ctx = this.renderer.sampleContextFor(tpl.eventKey);
    const rendered = this.renderer.render(
      { subject: tpl.subject, bodyHtml: tpl.bodyHtml, bodyText: tpl.bodyText },
      ctx,
    );
    const result = await this.mailer.send({
      to: dto.to,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: rendered.text,
    });
    await this.logModel.create({
      eventKey: tpl.eventKey,
      templateId: tpl._id,
      contextRef: dto.contextRef ?? 'test',
      recipient: dto.to,
      subject: `[TEST] ${rendered.subject}`,
      bodyHtml: rendered.html,
      status: result.ok ? 'sent' : 'failed',
      error: result.ok ? undefined : result.reason,
      sentAt: result.ok ? new Date() : undefined,
      triggeredBy: userId,
    });
    return result;
  }

  // ---------- Rules ----------
  listRules(filter: { eventKey?: string; enabled?: boolean } = {}) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.eventKey) query.eventKey = filter.eventKey;
    if (filter.enabled !== undefined) query.enabled = filter.enabled;
    return this.ruleModel
      .find(query)
      .populate('templateId', 'name subject')
      .sort({ name: 1 });
  }
  createRule(dto: CreateRuleDto, userId?: Types.ObjectId) {
    if (!findEventByKey(dto.eventKey)) {
      throw new BadRequestException(`Unknown eventKey: ${dto.eventKey}`);
    }
    return this.ruleModel.create({
      ...dto,
      templateId: new Types.ObjectId(dto.templateId),
      createdBy: userId,
      updatedBy: userId,
    });
  }
  async updateRule(id: string, dto: UpdateRuleDto, userId?: Types.ObjectId) {
    const rule = await this.ruleModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      {
        ...dto,
        templateId: dto.templateId ? new Types.ObjectId(dto.templateId) : undefined,
        updatedBy: userId,
      },
      { new: true },
    );
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }
  async deleteRule(id: string) {
    const rule = await this.ruleModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date() },
      { new: true },
    );
    if (!rule) throw new NotFoundException('Rule not found');
    return rule;
  }

  // ---------- Log ----------
  listLog(filter: { eventKey?: string; status?: string; limit?: number } = {}) {
    const query: Record<string, unknown> = {};
    if (filter.eventKey) query.eventKey = filter.eventKey;
    if (filter.status) query.status = filter.status;
    const limit = Math.min(Math.max(filter.limit ?? 100, 1), 500);
    return this.logModel.find(query).sort({ createdAt: -1 }).limit(limit);
  }

  // ---------- Dispatch ----------
  async dispatch(params: {
    eventKey: string;
    contextRef: string;
    context: Record<string, unknown>;
    dedupeKey: string;
    contractId?: Types.ObjectId;
    projectId?: Types.ObjectId;
    clientId?: Types.ObjectId;
  }) {
    const existing = await this.logModel.findOne({ dedupeKey: params.dedupeKey });
    if (existing) {
      return { skipped: true, reason: 'dedupe' as const };
    }

    const rules = await this.ruleModel
      .find({ eventKey: params.eventKey, enabled: true, deletedAt: { $exists: false } })
      .populate('templateId');

    if (rules.length === 0) {
      return { skipped: true, reason: 'no-rule' as const };
    }

    let sentCount = 0;
    let failedCount = 0;

    for (const rule of rules) {
      if (!this.matchesConditions(rule.conditions, params.context)) continue;

      const tpl = rule.templateId as unknown as NotificationTemplateDocument;
      if (!tpl || !tpl.isActive) continue;

      const recipients = await this.resolveRecipients(rule.recipients, {
        contractId: params.contractId,
        projectId: params.projectId,
        clientId: params.clientId,
      });

      if (recipients.length === 0) {
        await this.logModel.create({
          eventKey: params.eventKey,
          ruleId: rule._id,
          templateId: tpl._id,
          contextRef: params.contextRef,
          recipient: '(no recipients)',
          subject: tpl.subject,
          status: 'skipped',
          error: 'No recipients resolved',
          dedupeKey: `${params.dedupeKey}::${rule._id}::norecip`,
        });
        continue;
      }

      const rendered = this.renderer.render(tpl, params.context);

      for (const recipient of recipients) {
        const result = await this.mailer.send({
          to: recipient.email,
          subject: rendered.subject,
          html: rendered.html,
          text: rendered.text,
        });
        await this.logModel.create({
          eventKey: params.eventKey,
          ruleId: rule._id,
          templateId: tpl._id,
          contextRef: params.contextRef,
          recipient: recipient.email,
          subject: rendered.subject,
          bodyHtml: rendered.html,
          status: result.ok ? 'sent' : 'failed',
          error: result.ok ? undefined : result.reason,
          sentAt: result.ok ? new Date() : undefined,
          dedupeKey: `${params.dedupeKey}::${rule._id}::${recipient.email}`,
        });
        if (result.ok) sentCount++;
        else failedCount++;
      }
      rule.lastTriggeredAt = new Date();
      await rule.save();
    }

    return { skipped: false as const, sent: sentCount, failed: failedCount };
  }

  private matchesConditions(conditions: Record<string, unknown>, context: Record<string, unknown>): boolean {
    if (!conditions) return true;
    if (typeof conditions.daysBeforeDue === 'number') {
      const days = (context as Record<string, number>).daysUntilExpiry ?? (context as Record<string, number>).daysUntilDue;
      if (days !== conditions.daysBeforeDue) return false;
    }
    if (typeof conditions.minAmount === 'number') {
      const amount =
        (context as any)?.contract?.amount ?? (context as any)?.amount ?? 0;
      if (Number(amount) < conditions.minAmount) return false;
    }
    if (typeof conditions.currency === 'string') {
      const currency = (context as any)?.contract?.currency ?? (context as any)?.currency;
      if (currency !== conditions.currency) return false;
    }
    return true;
  }

  private async resolveRecipients(
    expressions: string[],
    ctx: {
      contractId?: Types.ObjectId;
      projectId?: Types.ObjectId;
      clientId?: Types.ObjectId;
    },
  ): Promise<ResolvedRecipient[]> {
    const out: ResolvedRecipient[] = [];
    for (const expr of expressions) {
      try {
        if (expr.startsWith('custom:')) {
          const email = expr.substring('custom:'.length).trim();
          if (email) out.push({ expression: expr, email });
          continue;
        }
        if (expr === 'project.assignedTo' && ctx.projectId) {
          const project = await this.projectsService.findById(ctx.projectId.toString()).catch(() => null);
          const user = project && (project as any).assignedTo
            ? await this.usersService.findById(((project as any).assignedTo as Types.ObjectId).toString())
            : null;
          if (user?.email) out.push({ expression: expr, email: user.email });
          continue;
        }
        if (expr === 'contract.client' && ctx.clientId) {
          const client = await this.clientsService.findById(ctx.clientId.toString()).catch(() => null);
          if (client && (client as any).email) out.push({ expression: expr, email: (client as any).email });
          continue;
        }
        if (expr === 'admin') {
          const admins = await this.usersService.findAdmins();
          for (const admin of admins) {
            if (admin.email) out.push({ expression: expr, email: admin.email });
          }
          continue;
        }
      } catch (err) {
        this.logger.warn(`Failed to resolve recipient ${expr}: ${(err as Error).message}`);
      }
    }
    // Dedupe by email
    const seen = new Set<string>();
    return out.filter((r) => {
      const key = r.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  // ---------- Seeding ----------
  private async seedDefaults() {
    const groupCount = await this.groupModel.countDocuments({});
    const groupMap = new Map<string, Types.ObjectId>();

    if (groupCount === 0) {
      const created = await this.groupModel.insertMany(
        SEED_GROUPS.map((g) => ({ ...g, isSystem: true })),
      );
      created.forEach((g) => groupMap.set(g.name.toLowerCase(), g._id));
      this.logger.log(`Seeded ${created.length} template groups`);
    } else {
      const groups = await this.groupModel.find({});
      groups.forEach((g) => groupMap.set(g.name.toLowerCase(), g._id));
    }

    const templateCount = await this.templateModel.countDocuments({ isSystem: true });
    if (templateCount === 0) {
      const docs = SEED_TEMPLATES.map((t) => {
        const matchKey = SEED_GROUPS.find((g) => g.key === t.group)?.name.toLowerCase();
        return {
          name: t.name,
          description: t.description,
          eventKey: t.eventKey,
          subject: t.subject,
          bodyHtml: t.bodyHtml,
          isSystem: true,
          isActive: true,
          channel: 'email' as const,
          groupId: matchKey ? groupMap.get(matchKey) : undefined,
        };
      });
      const inserted = await this.templateModel.insertMany(docs);
      this.logger.log(`Seeded ${inserted.length} system templates`);
    }
  }
}
