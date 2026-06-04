import { Injectable } from '@nestjs/common';
import { EstimatesService } from '../estimates/estimates.service';
import { ProjectsService } from '../projects/projects.service';

/**
 * PublicService — exposes ONLY the fields safe to show an external,
 * unauthenticated client. Internal notes, credentials, audit fields,
 * and database IDs are stripped before leaving the API.
 */
@Injectable()
export class PublicService {
  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly projectsService: ProjectsService,
  ) {}

  async getSharedEstimate(token: string) {
    const e = await this.estimatesService.findByShareToken(token);
    const client = e.clientId as { name?: string } | null;
    const service = e.serviceId as { name?: string } | null;
    return {
      title: e.title ?? 'Proposal',
      clientName: client?.name ?? '',
      serviceName: service?.name ?? '',
      billingPeriod: e.billingPeriod,
      amount: e.amount,
      currency: e.currency,
      status: e.status,
      scope: e.scope ?? '',
      deliverables: e.deliverables ?? [],
      terms: e.terms ?? '',
      validUntil: e.validUntil ?? null,
      sentAt: e.sentAt ?? null,
      // Never expose: notes (internal), createdBy, updatedBy, shareToken, IDs.
    };
  }

  async getSharedProject(token: string) {
    const { project, tasks } = await this.projectsService.findByShareToken(token);
    const client = project.clientId as { name?: string } | null;
    const service = project.serviceId as { name?: string } | null;
    const contract = project.contractId as {
      title?: string;
      billingPeriod?: string;
    } | null;

    return {
      name: project.name,
      description: project.description ?? '',
      clientName: client?.name ?? '',
      serviceName: service?.name ?? '',
      contractTitle: contract?.title ?? '',
      status: project.status,
      progress: project.progress ?? 0,
      startDate: project.startDate ?? null,
      dueDate: project.dueDate ?? null,
      tags: project.tags ?? [],
      deliverables: (project.deliverables ?? []).map((d) => ({
        label: d.label,
        done: !!d.done,
        doneAt: d.doneAt ?? null,
      })),
      tasks: tasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
      // Never expose: notes (internal), credentials, assignedTo,
      // createdBy, updatedBy, shareToken, IDs.
    };
  }
}
