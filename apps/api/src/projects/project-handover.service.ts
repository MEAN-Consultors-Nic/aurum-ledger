import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
// pdfmake 0.3.x exports a configured singleton instance (NOT a constructor).
// API: setFonts(fonts) → createPdf(definition) → { getBuffer(): Promise<Buffer> }.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfmake = require('pdfmake') as {
  setFonts(fonts: Record<string, unknown>): void;
  createPdf(definition: unknown): { getBuffer(): Promise<Buffer> };
};
import type {
  Content,
  StyleDictionary,
  TDocumentDefinitions,
} from 'pdfmake/interfaces';
import { Client, ClientDocument } from '../clients/schemas/client.schema';
import { Contract, ContractDocument } from '../contracts/schemas/contract.schema';
import { Service, ServiceDocument } from '../services/schemas/service.schema';
import { Project, ProjectDocument } from './schemas/project.schema';
import {
  ProjectCredential,
  ProjectCredentialDocument,
} from './schemas/project-credential.schema';
import { ProjectTask, ProjectTaskDocument } from './schemas/project-task.schema';

// Standard PDF fonts — no font files needed, they're built into PDFKit.
const FONTS = {
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
};

@Injectable()
export class ProjectHandoverService {
  // pdfmake is a process-level singleton in 0.3.x; calling setFonts once is enough.
  private static fontsRegistered = false;

  constructor(
    @InjectModel(Project.name) private readonly projectModel: Model<ProjectDocument>,
    @InjectModel(ProjectTask.name) private readonly taskModel: Model<ProjectTaskDocument>,
    @InjectModel(ProjectCredential.name)
    private readonly credentialModel: Model<ProjectCredentialDocument>,
    @InjectModel(Client.name) private readonly clientModel: Model<ClientDocument>,
    @InjectModel(Service.name) private readonly serviceModel: Model<ServiceDocument>,
    @InjectModel(Contract.name) private readonly contractModel: Model<ContractDocument>,
  ) {}

  async generate(projectId: string): Promise<{ buffer: Buffer; filename: string }> {
    const project = await this.projectModel.findOne({
      _id: projectId,
      deletedAt: { $exists: false },
    });
    if (!project) {
      throw new NotFoundException('Project not found');
    }

    // Pull related entities in parallel. Credentials are read directly from
    // the model so we never touch the encrypted blob — only public metadata.
    const [tasks, credentials, client, service, contract] = await Promise.all([
      this.taskModel
        .find({ projectId: project._id, deletedAt: { $exists: false } })
        .sort({ status: 1, order: 1 }),
      this.credentialModel
        .find({ projectId: project._id, deletedAt: { $exists: false } })
        .select('type name notes createdAt')
        .sort({ createdAt: 1 }),
      this.clientModel.findById(project.clientId).select('name email phone'),
      project.serviceId
        ? this.serviceModel.findById(project.serviceId).select('name')
        : Promise.resolve(null),
      project.contractId
        ? this.contractModel
            .findById(project.contractId)
            .select('title amount currency billingPeriod startDate endDate')
        : Promise.resolve(null),
    ]);

    if (!ProjectHandoverService.fontsRegistered) {
      pdfmake.setFonts(FONTS);
      ProjectHandoverService.fontsRegistered = true;
    }
    const definition = this.buildDocument({
      project,
      tasks,
      credentials,
      client,
      service,
      contract,
    });
    const buffer = await pdfmake.createPdf(definition).getBuffer();

    const slug = this.slug(project.name);
    const date = new Date().toISOString().slice(0, 10);
    const filename = `handover-${slug}-${date}.pdf`;
    return { buffer, filename };
  }

  // -------------------- doc assembly --------------------

  private buildDocument(input: {
    project: ProjectDocument;
    tasks: ProjectTaskDocument[];
    credentials: ProjectCredentialDocument[];
    client: ClientDocument | null;
    service: ServiceDocument | null;
    contract: ContractDocument | null;
  }): TDocumentDefinitions {
    const { project, tasks, credentials, client, service, contract } = input;

    const taskCounts = {
      todo: tasks.filter((t) => t.status === 'todo').length,
      in_progress: tasks.filter((t) => t.status === 'in_progress').length,
      blocked: tasks.filter((t) => t.status === 'blocked').length,
      done: tasks.filter((t) => t.status === 'done').length,
    };
    const doneTasks = tasks.filter((t) => t.status === 'done');

    const content: Content[] = [];

    // -------- Cover --------
    content.push(
      { text: project.name, style: 'h1', margin: [0, 60, 0, 4] },
      {
        text: `Prepared for ${client?.name ?? 'Client'}`,
        style: 'subtitle',
      },
      {
        text: `Issued ${this.formatDate(new Date())}`,
        style: 'meta',
        margin: [0, 2, 0, 18],
      },
      {
        canvas: [
          { type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 1, lineColor: '#0f172a' },
        ],
        margin: [0, 0, 0, 18],
      },
    );

    // -------- Project info table --------
    content.push(
      { text: 'Project information', style: 'h2' },
      {
        table: {
          widths: ['30%', '*'],
          body: [
            [
              { text: 'Status', style: 'th' },
              this.statusBadge(project.status),
            ],
            [
              { text: 'Service', style: 'th' },
              { text: service?.name ?? '—' },
            ],
            [
              { text: 'Contract', style: 'th' },
              {
                text: contract
                  ? `${contract.title ?? 'Untitled contract'} · ${contract.currency} ${this.formatAmount(contract.amount)}`
                  : '—',
              },
            ],
            [
              { text: 'Start date', style: 'th' },
              { text: this.formatDate(project.startDate) },
            ],
            [
              {
                text: project.status === 'completed' ? 'Completed on' : 'Due date',
                style: 'th',
              },
              { text: this.formatDate(project.dueDate) },
            ],
            [
              { text: 'Progress', style: 'th' },
              { text: `${project.progress ?? 0}%` },
            ],
            [
              { text: 'Client contact', style: 'th' },
              {
                text:
                  client?.name && client?.email
                    ? `${client.name} · ${client.email}`
                    : client?.name ?? '—',
              },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 4, 0, 18],
      },
    );

    // -------- Scope / description --------
    if (project.description && project.description.trim().length > 0) {
      content.push(
        { text: 'Scope', style: 'h2' },
        { text: project.description, margin: [0, 4, 0, 18] },
      );
    }

    // -------- Deliverables --------
    if (project.deliverables && project.deliverables.length > 0) {
      const doneCount = project.deliverables.filter((d) => d.done).length;
      content.push(
        {
          text: `Deliverables (${doneCount} / ${project.deliverables.length} complete)`,
          style: 'h2',
        },
        {
          ul: project.deliverables.map((d) => ({
            text: `${d.done ? '[done] ' : '[pending] '}${d.label}${
              d.done && d.doneAt ? `  —  ${this.formatDate(d.doneAt)}` : ''
            }`,
            style: d.done ? 'doneItem' : 'pendingItem',
          })),
          margin: [0, 4, 0, 18],
        },
      );
    }

    // -------- Tasks summary --------
    content.push(
      { text: 'Tasks', style: 'h2' },
      {
        table: {
          widths: ['*', '*', '*', '*'],
          body: [
            [
              { text: 'To do', style: 'th', alignment: 'center' },
              { text: 'Doing', style: 'th', alignment: 'center' },
              { text: 'Blocked', style: 'th', alignment: 'center' },
              { text: 'Done', style: 'th', alignment: 'center' },
            ],
            [
              { text: String(taskCounts.todo), alignment: 'center', style: 'big' },
              { text: String(taskCounts.in_progress), alignment: 'center', style: 'big' },
              { text: String(taskCounts.blocked), alignment: 'center', style: 'big' },
              {
                text: String(taskCounts.done),
                alignment: 'center',
                style: 'bigDone',
              },
            ],
          ],
        },
        layout: 'lightHorizontalLines',
        margin: [0, 4, 0, 10],
      },
    );

    if (doneTasks.length > 0) {
      content.push(
        { text: 'Completed tasks', style: 'h3' },
        {
          ul: doneTasks.map((t) => ({
            text: `${t.title}${
              t.completedAt ? `  —  ${this.formatDate(t.completedAt)}` : ''
            }`,
            style: 'doneItem',
          })),
          margin: [0, 4, 0, 18],
        },
      );
    }

    // -------- Credentials inventory (no secrets) --------
    if (credentials.length > 0) {
      content.push(
        { text: 'Credentials inventory', style: 'h2' },
        {
          text: 'The following credentials were configured for this project. Secret values are stored encrypted in AurumLedger and are intentionally not included in this document.',
          style: 'caption',
          margin: [0, 4, 0, 8],
        },
        {
          table: {
            headerRows: 1,
            widths: ['25%', '35%', '*'],
            body: [
              [
                { text: 'Type', style: 'th' },
                { text: 'Name', style: 'th' },
                { text: 'Notes', style: 'th' },
              ],
              ...credentials.map((c) => [
                { text: this.formatCredentialType(c.type) },
                { text: c.name },
                { text: c.notes ?? '—', style: 'caption' },
              ]),
            ],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 18],
        },
      );
    }

    // -------- Project notes --------
    if (project.notes && project.notes.length > 0) {
      content.push({ text: 'Notes', style: 'h2', margin: [0, 0, 0, 4] });
      project.notes.forEach((n) => {
        content.push(
          { text: n.title, style: 'h3', margin: [0, 6, 0, 2] },
          { text: n.body, margin: [0, 0, 0, 6] },
        );
      });
      content.push({ text: '', margin: [0, 0, 0, 12] });
    }

    // -------- Sign-off (new page) --------
    content.push(
      { text: 'Acknowledgement', style: 'h2', pageBreak: 'before', margin: [0, 0, 0, 8] },
      {
        text: 'By signing below, the client acknowledges receipt of the deliverables described above and accepts the conclusion of this engagement. Any subsequent work falls under a new engagement.',
        margin: [0, 0, 0, 36],
      },
      {
        columns: [
          {
            stack: [
              { text: '_____________________________________', margin: [0, 0, 0, 4] },
              { text: 'Client signature', style: 'caption' },
              { text: client?.name ?? '', style: 'caption', margin: [0, 1, 0, 0] },
            ],
          },
          {
            stack: [
              { text: '_____________________________________', margin: [0, 0, 0, 4] },
              { text: 'Date', style: 'caption' },
            ],
          },
        ],
        columnGap: 30,
      },
      {
        columns: [
          {
            stack: [
              { text: '_____________________________________', margin: [0, 36, 0, 4] },
              { text: 'MEAN Consultors', style: 'caption' },
            ],
          },
          {
            stack: [
              { text: '_____________________________________', margin: [0, 36, 0, 4] },
              { text: 'Date', style: 'caption' },
            ],
          },
        ],
        columnGap: 30,
      },
    );

    return {
      pageSize: 'LETTER',
      pageMargins: [50, 70, 50, 60],
      defaultStyle: { font: 'Helvetica', fontSize: 10, color: '#0f172a', lineHeight: 1.35 },
      header: {
        columns: [
          { text: 'MEAN CONSULTORS', style: 'brand' },
          {
            text: 'PROJECT HANDOVER REPORT',
            alignment: 'right',
            style: 'subbrand',
          },
        ],
        margin: [50, 30, 50, 0],
      },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          {
            text: `Generated by AurumLedger · ${this.formatDate(new Date())}`,
            style: 'footer',
          },
          {
            text: `Page ${currentPage} of ${pageCount}`,
            alignment: 'right',
            style: 'footer',
          },
        ],
        margin: [50, 0, 50, 30],
      }),
      content,
      styles: this.styles(),
    };
  }

  private styles(): StyleDictionary {
    return {
      brand: { fontSize: 10, bold: true, color: '#0f172a', characterSpacing: 1 },
      subbrand: { fontSize: 9, color: '#64748b', characterSpacing: 1 },
      footer: { fontSize: 8, color: '#94a3b8' },
      h1: { fontSize: 26, bold: true, color: '#0f172a' },
      subtitle: { fontSize: 13, color: '#475569' },
      meta: { fontSize: 10, color: '#94a3b8' },
      h2: {
        fontSize: 13,
        bold: true,
        color: '#0f172a',
        margin: [0, 14, 0, 4],
      },
      h3: { fontSize: 11, bold: true, color: '#334155' },
      th: { bold: true, color: '#475569', fontSize: 9 },
      caption: { fontSize: 9, color: '#64748b' },
      doneItem: { color: '#059669' },
      pendingItem: { color: '#94a3b8' },
      big: { fontSize: 18, bold: true, color: '#0f172a' },
      bigDone: { fontSize: 18, bold: true, color: '#059669' },
    };
  }

  // -------------------- helpers --------------------

  private statusBadge(status: string): Content {
    const labels: Record<string, string> = {
      active: 'ACTIVE',
      on_hold: 'ON HOLD',
      completed: 'COMPLETED',
      archived: 'ARCHIVED',
    };
    return {
      text: labels[status] ?? status.toUpperCase(),
      bold: true,
      color: status === 'completed' ? '#059669' : '#0f172a',
    };
  }

  private formatCredentialType(type: string): string {
    return type
      .replace(/[_-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  }

  private formatDate(value?: Date | string | null): string {
    if (!value) return '—';
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  private formatAmount(value: number | undefined): string {
    return Number(value ?? 0).toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  private slug(input: string): string {
    return (input || 'project')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60);
  }
}
