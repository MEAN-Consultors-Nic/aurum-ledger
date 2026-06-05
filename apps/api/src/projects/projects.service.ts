import { randomBytes } from 'crypto';
import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { GithubService } from '../github/github.service';
import { SettingsService } from '../settings/settings.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { CreateNoteDto, UpdateNoteDto } from './dto/note.dto';
import { CreateDeliverableDto, UpdateDeliverableDto } from './dto/deliverable.dto';
import { Project, ProjectDocument } from './schemas/project.schema';
import { ProjectTask, ProjectTaskDocument } from './schemas/project-task.schema';
import { ProjectCredential, ProjectCredentialDocument } from './schemas/project-credential.schema';
import {
  findTemplateByKey,
  inferTemplate,
  ProjectTemplate,
} from './templates';

type CreateFromContractInput = {
  contractId: Types.ObjectId;
  clientId: Types.ObjectId;
  serviceId?: Types.ObjectId;
  contractTitle?: string;
  serviceName?: string;
  clientName?: string;
  startDate?: Date;
  endDate?: Date;
  createGithubRepo?: boolean;
  userId?: Types.ObjectId;
};

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectTask.name) private readonly taskModel: Model<ProjectTaskDocument>,
    @InjectModel(ProjectCredential.name)
    private readonly credentialModel: Model<ProjectCredentialDocument>,
    private readonly githubService: GithubService,
    private readonly settingsService: SettingsService,
    private readonly customFieldsService: CustomFieldsService,
  ) {}

  async list(filter: { status?: string; clientId?: string; search?: string } = {}) {
    const query: Record<string, unknown> = { deletedAt: { $exists: false } };
    if (filter.status) {
      query.status = filter.status;
    }
    if (filter.clientId) {
      query.clientId = new Types.ObjectId(filter.clientId);
    }
    if (filter.search) {
      query.name = { $regex: filter.search, $options: 'i' };
    }

    const items = await this.projectModel
      .find(query)
      .populate('clientId', 'name')
      .populate('serviceId', 'name')
      .populate('contractId', 'title amount currency status')
      .sort({ updatedAt: -1 });

    const projectIds = items.map((p) => p._id);
    const taskCounts = await this.taskModel.aggregate([
      { $match: { projectId: { $in: projectIds }, deletedAt: { $exists: false } } },
      {
        $group: {
          _id: { projectId: '$projectId', status: '$status' },
          count: { $sum: 1 },
        },
      },
    ]);

    const taskMap = new Map<string, { total: number; done: number }>();
    for (const row of taskCounts) {
      const id = row._id.projectId.toString();
      const entry = taskMap.get(id) ?? { total: 0, done: 0 };
      entry.total += row.count;
      if (row._id.status === 'done') {
        entry.done += row.count;
      }
      taskMap.set(id, entry);
    }

    return items.map((doc) => {
      const obj = doc.toObject();
      const counts = taskMap.get(doc._id.toString()) ?? { total: 0, done: 0 };
      return { ...obj, taskTotal: counts.total, taskDone: counts.done };
    });
  }

  async findById(id: string) {
    const project = await this.projectModel
      .findOne({ _id: id, deletedAt: { $exists: false } })
      .populate('clientId', 'name')
      .populate('serviceId', 'name')
      .populate('contractId', 'title amount currency status startDate endDate');
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async create(dto: CreateProjectDto, userId?: Types.ObjectId) {
    const project = await this.projectModel.create({
      ...dto,
      contractId: new Types.ObjectId(dto.contractId),
      clientId: new Types.ObjectId(dto.clientId),
      serviceId: dto.serviceId ? new Types.ObjectId(dto.serviceId) : undefined,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      createdBy: userId,
      updatedBy: userId,
    });

    if (dto.templateKey) {
      await this.applyTemplate(project._id.toString(), dto.templateKey, userId);
    }

    return project;
  }

  async createFromContract(input: CreateFromContractInput) {
    const existing = await this.projectModel.findOne({
      contractId: input.contractId,
      deletedAt: { $exists: false },
    });
    if (existing) {
      return existing;
    }

    const template = inferTemplate(input.serviceName, input.contractTitle);
    const name =
      input.contractTitle && input.contractTitle.trim()
        ? input.contractTitle
        : input.serviceName
          ? `${input.serviceName}`
          : 'New project';

    const project = await this.projectModel.create({
      name,
      contractId: input.contractId,
      clientId: input.clientId,
      serviceId: input.serviceId,
      status: 'active',
      startDate: input.startDate,
      dueDate: input.endDate,
      templateKey: template.key,
      deliverables: template.deliverables.map((label) => ({ label, done: false })),
      createdBy: input.userId,
      updatedBy: input.userId,
    });

    if (template.tasks.length > 0) {
      await this.taskModel.insertMany(
        template.tasks.map((task, idx) => ({
          projectId: project._id,
          title: task.title,
          description: task.description,
          priority: task.priority ?? 'medium',
          status: 'todo',
          order: idx,
          createdBy: input.userId,
          updatedBy: input.userId,
        })),
      );
    }

    // Best-effort GitHub repo creation. Failures must not block the
    // project / contract conversion — log and continue.
    const wantsRepo = await this.shouldAutoCreateRepo(input.createGithubRepo);
    if (wantsRepo) {
      try {
        const slug = this.buildRepoSlug(input.clientName, name);
        const repo = await this.githubService.createRepository({
          name: slug,
          description: `${name} — ${input.clientName ?? 'Helm project'}`,
        });
        project.githubRepo = {
          owner: repo.owner,
          name: repo.name,
          htmlUrl: repo.htmlUrl,
          createdAt: new Date(repo.createdAt),
          linkedAt: new Date(),
        };
        await project.save();
      } catch (err) {
        const msg = (err as Error)?.message ?? 'unknown error';
        this.logger.warn(`GitHub repo creation skipped for project ${project._id}: ${msg}`);
      }
    }

    return project;
  }

  private async shouldAutoCreateRepo(explicit?: boolean): Promise<boolean> {
    if (explicit === false) return false;
    if (!(await this.githubService.isConfigured())) return false;
    if (explicit === true) return true;
    const settings = await this.settingsService.getGithubSettings();
    return settings.autoCreate;
  }

  private buildRepoSlug(clientName: string | undefined, projectName: string): string {
    const client = this.githubService.slug(clientName ?? '');
    const proj = this.githubService.slug(projectName);
    const parts = ['mean', client, proj].filter((p) => p.length > 0);
    return parts.join('-');
  }

  async update(id: string, dto: UpdateProjectDto, userId?: Types.ObjectId) {
    const update: Record<string, unknown> = {
      ...dto,
      startDate: dto.startDate ? new Date(dto.startDate) : undefined,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      updatedBy: userId,
    };
    if (dto.customValues !== undefined) {
      update.customValues = await this.customFieldsService.validateValues(
        'project',
        dto.customValues,
      );
    }
    const project = await this.projectModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      update,
      { new: true },
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  async remove(id: string, userId?: Types.ObjectId) {
    const project = await this.projectModel.findOneAndUpdate(
      { _id: id, deletedAt: { $exists: false } },
      { deletedAt: new Date(), updatedBy: userId },
      { new: true },
    );
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }

  // ---------- Notes (embedded) ----------
  async addNote(id: string, dto: CreateNoteDto, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    project.notes.push({
      title: dto.title,
      body: dto.body,
      createdBy: userId,
    } as any);
    project.updatedBy = userId as any;
    await project.save();
    return project;
  }

  async updateNote(id: string, noteId: string, dto: UpdateNoteDto, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    const note = (project.notes as any).id(noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    if (dto.title !== undefined) note.title = dto.title;
    if (dto.body !== undefined) note.body = dto.body;
    project.updatedBy = userId as any;
    await project.save();
    return project;
  }

  async deleteNote(id: string, noteId: string, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    const note = (project.notes as any).id(noteId);
    if (!note) {
      throw new NotFoundException('Note not found');
    }
    note.deleteOne();
    project.updatedBy = userId as any;
    await project.save();
    return project;
  }

  // ---------- Deliverables (embedded) ----------
  async addDeliverable(id: string, dto: CreateDeliverableDto, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    project.deliverables.push({ label: dto.label, note: dto.note, done: false } as any);
    project.updatedBy = userId as any;
    await project.save();
    return project;
  }

  async updateDeliverable(
    id: string,
    deliverableId: string,
    dto: UpdateDeliverableDto,
    userId?: Types.ObjectId,
  ) {
    const project = await this.requireActive(id);
    const item = (project.deliverables as any).id(deliverableId);
    if (!item) {
      throw new NotFoundException('Deliverable not found');
    }
    if (dto.label !== undefined) item.label = dto.label;
    if (dto.note !== undefined) item.note = dto.note;
    if (dto.done !== undefined) {
      item.done = dto.done;
      item.doneAt = dto.done ? new Date() : undefined;
      item.doneBy = dto.done ? userId : undefined;
    }
    project.updatedBy = userId as any;
    await project.save();
    return project;
  }

  async deleteDeliverable(id: string, deliverableId: string, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    const item = (project.deliverables as any).id(deliverableId);
    if (!item) {
      throw new NotFoundException('Deliverable not found');
    }
    item.deleteOne();
    project.updatedBy = userId as any;
    await project.save();
    return project;
  }

  // ---------- Templates ----------
  async applyTemplate(id: string, templateKey: string, userId?: Types.ObjectId) {
    const template = findTemplateByKey(templateKey);
    if (!template) {
      throw new BadRequestException(`Unknown template "${templateKey}"`);
    }
    const project = await this.requireActive(id);

    template.deliverables.forEach((label) => {
      if (!project.deliverables.some((d) => d.label === label)) {
        (project.deliverables as any).push({ label, done: false });
      }
    });
    project.templateKey = template.key;
    project.updatedBy = userId as any;
    await project.save();

    const existingTasks = await this.taskModel
      .find({ projectId: project._id, deletedAt: { $exists: false } })
      .select('title');
    const existingTitles = new Set(existingTasks.map((t) => t.title));
    const maxOrder = existingTasks.length;
    const toInsert = template.tasks
      .filter((t) => !existingTitles.has(t.title))
      .map((task, idx) => ({
        projectId: project._id,
        title: task.title,
        description: task.description,
        priority: task.priority ?? 'medium',
        status: 'todo' as const,
        order: maxOrder + idx,
        createdBy: userId,
        updatedBy: userId,
      }));
    if (toInsert.length > 0) {
      await this.taskModel.insertMany(toInsert);
    }

    return { project, addedTasks: toInsert.length, template };
  }

  listTemplates(): ProjectTemplate[] {
    return require('./templates').PROJECT_TEMPLATES as ProjectTemplate[];
  }

  // ------------------------------------------------------------
  // Client-portal share link
  // ------------------------------------------------------------

  async generateShareToken(id: string, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    project.shareToken = randomBytes(32).toString('base64url');
    project.shareCreatedAt = new Date();
    project.shareCreatedBy = userId;
    project.shareRevokedAt = undefined;
    project.shareViewCount = 0;
    project.shareLastViewedAt = undefined;
    project.updatedBy = userId;
    await project.save();
    return {
      shareToken: project.shareToken,
      shareCreatedAt: project.shareCreatedAt,
      shareRevokedAt: project.shareRevokedAt,
      shareViewCount: project.shareViewCount,
      shareLastViewedAt: project.shareLastViewedAt,
    };
  }

  async revokeShareToken(id: string, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    project.shareRevokedAt = new Date();
    project.updatedBy = userId;
    await project.save();
    return { revoked: true };
  }

  async findByShareToken(token: string) {
    const project = await this.projectModel
      .findOneAndUpdate(
        {
          shareToken: token,
          shareRevokedAt: { $exists: false },
          deletedAt: { $exists: false },
        },
        {
          $inc: { shareViewCount: 1 },
          $set: { shareLastViewedAt: new Date() },
        },
        { new: true },
      )
      .populate('clientId', 'name')
      .populate('serviceId', 'name')
      .populate('contractId', 'title billingPeriod');
    if (!project) {
      throw new NotFoundException('This link is no longer valid');
    }
    const tasks = await this.taskModel
      .find({ projectId: project._id, deletedAt: { $exists: false } })
      .sort({ status: 1, order: 1 });
    return { project, tasks };
  }

  // ------------------------------------------------------------
  // GitHub repo link
  // ------------------------------------------------------------

  async linkGithubRepo(id: string, repoUrl: string, userId?: Types.ObjectId) {
    const ref = this.githubService.parseRepoRef(repoUrl);
    if (!ref) {
      throw new BadRequestException(
        'Provide a valid GitHub repo URL (https://github.com/owner/name) or "owner/name".',
      );
    }
    const project = await this.requireActive(id);
    project.githubRepo = {
      owner: ref.owner,
      name: ref.name,
      htmlUrl: `https://github.com/${ref.owner}/${ref.name}`,
      linkedAt: new Date(),
    };
    project.updatedBy = userId;
    await project.save();
    return project.githubRepo;
  }

  async unlinkGithubRepo(id: string, userId?: Types.ObjectId) {
    const project = await this.requireActive(id);
    project.githubRepo = undefined;
    project.updatedBy = userId;
    await project.save();
    return { unlinked: true };
  }

  async getGithubActivity(id: string) {
    const project = await this.requireActive(id);
    if (!project.githubRepo) {
      throw new BadRequestException('No GitHub repo linked to this project.');
    }
    return this.githubService.getActivity(
      project.githubRepo.owner,
      project.githubRepo.name,
    );
  }

  // ---------- helpers ----------
  private async requireActive(id: string) {
    const project = await this.projectModel.findOne({
      _id: id,
      deletedAt: { $exists: false },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }
    return project;
  }
}
