import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Estimate, EstimateDocument } from '../estimates/schemas/estimate.schema';
import {
  ProjectTask,
  ProjectTaskDocument,
} from '../projects/schemas/project-task.schema';
import { Project, ProjectDocument } from '../projects/schemas/project.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';

export type SearchResultType =
  | 'client'
  | 'estimate'
  | 'contract'
  | 'project'
  | 'task'
  | 'service';

export type SearchResult = {
  type: SearchResultType;
  _id: string;
  label: string;
  subtitle: string;
  url: string;
};

const PER_TYPE_LIMIT = 5;
const MIN_QUERY_LEN = 2;

@Injectable()
export class SearchService {
  constructor(
    @InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Estimate.name) private readonly estimateModel: Model<EstimateDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectTask.name) private readonly taskModel: Model<ProjectTaskDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
  ) {}

  async search(query: string): Promise<{ results: SearchResult[] }> {
    const q = (query ?? '').trim();
    if (q.length < MIN_QUERY_LEN) {
      return { results: [] };
    }

    const rx = new RegExp(this.escapeRegex(q), 'i');
    const notDeleted = { deletedAt: { $exists: false } };

    const [clients, estimates, contracts, projects, tasks, services] = await Promise.all([
      this.clientModel
        .find({ ...notDeleted, $or: [{ name: rx }, { email: rx }] })
        .limit(PER_TYPE_LIMIT)
        .select('_id name email'),
      this.estimateModel
        .find({ ...notDeleted, title: rx })
        .populate('clientId', 'name')
        .limit(PER_TYPE_LIMIT)
        .select('_id title amount currency status clientId'),
      this.contractModel
        .find({ ...notDeleted, title: rx })
        .populate('clientId', 'name')
        .limit(PER_TYPE_LIMIT)
        .select('_id title amount currency status clientId'),
      this.projectModel
        .find({ ...notDeleted, name: rx })
        .populate('clientId', 'name')
        .limit(PER_TYPE_LIMIT)
        .select('_id name status clientId'),
      this.taskModel
        .find({ ...notDeleted, title: rx })
        .populate('projectId', 'name')
        .limit(PER_TYPE_LIMIT)
        .select('_id title status projectId'),
      this.serviceModel
        .find({ ...notDeleted, name: rx })
        .limit(PER_TYPE_LIMIT)
        .select('_id name'),
    ]);

    const results: SearchResult[] = [];

    for (const c of clients) {
      results.push({
        type: 'client',
        _id: c._id.toString(),
        label: c.name,
        subtitle: c.email ?? 'Client',
        url: '/clients',
      });
    }
    for (const e of estimates) {
      const client = e.clientId as { name?: string } | null;
      results.push({
        type: 'estimate',
        _id: e._id.toString(),
        label: e.title || 'Untitled estimate',
        subtitle: `${client?.name ?? '—'} · ${e.currency} ${this.formatAmount(e.amount)} · ${e.status}`,
        url: `/estimates/${e._id}`,
      });
    }
    for (const c of contracts) {
      const client = c.clientId as { name?: string } | null;
      results.push({
        type: 'contract',
        _id: c._id.toString(),
        label: c.title || 'Untitled contract',
        subtitle: `${client?.name ?? '—'} · ${c.currency} ${this.formatAmount(c.amount)} · ${c.status}`,
        url: '/contracts',
      });
    }
    for (const p of projects) {
      const client = p.clientId as { name?: string } | null;
      results.push({
        type: 'project',
        _id: p._id.toString(),
        label: p.name,
        subtitle: `${client?.name ?? '—'} · ${p.status}`,
        url: `/projects/${p._id}`,
      });
    }
    for (const t of tasks) {
      const project = t.projectId as { _id?: unknown; name?: string } | null;
      const projectIdStr = project?._id?.toString?.() ?? '';
      results.push({
        type: 'task',
        _id: t._id.toString(),
        label: t.title,
        subtitle: `Project: ${project?.name ?? '—'} · ${t.status}`,
        url: projectIdStr ? `/projects/${projectIdStr}` : '/projects',
      });
    }
    for (const s of services) {
      results.push({
        type: 'service',
        _id: s._id.toString(),
        label: s.name,
        subtitle: 'Service',
        url: '/services',
      });
    }

    return { results };
  }

  private escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private formatAmount(value: number | undefined): string {
    return Number(value ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
}
