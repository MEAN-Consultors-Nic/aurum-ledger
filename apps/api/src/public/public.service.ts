import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  GoneException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
} from '@nestjs/common';
import { EstimatesService } from '../estimates/estimates.service';
import { EstimateDocument } from '../estimates/schemas/estimate.schema';
import {
  ShareLinkState,
  canViewContent,
  linkExpiresAt,
  shareLinkState,
  verifyPin,
} from '../estimates/share-link';
import { NotificationsEngineService } from '../notifications-engine/notifications-engine.service';
import { ProjectsService } from '../projects/projects.service';

/** Why a link does not open, as a stable code the portal page reads. */
const CLOSED_MESSAGES: Partial<Record<ShareLinkState, string>> = {
  revoked: 'This link was revoked. Please ask MEAN Consultors for a new one.',
  locked:
    'This link was locked after too many wrong PINs. Please ask MEAN Consultors for a new one.',
  expired:
    'This proposal has expired. Please contact MEAN Consultors if you are still interested.',
};

/**
 * PublicService — exposes ONLY the fields safe to show an external,
 * unauthenticated client. Internal notes, credentials, audit fields,
 * and database IDs are stripped before leaving the API.
 */
@Injectable()
export class PublicService {
  private readonly logger = new Logger(PublicService.name);

  constructor(
    private readonly estimatesService: EstimatesService,
    private readonly projectsService: ProjectsService,
    private readonly notifications: NotificationsEngineService,
  ) {}

  // ---------------------------------------------------------------
  // Estimate links (PIN protected)
  // ---------------------------------------------------------------

  /** Before the PIN: only whether the link opens. No proposal content. */
  async getEstimateLinkState(token: string) {
    const e = await this.estimatesService.findByShareToken(token);
    const state = this.linkStateOf(e);
    return {
      state,
      requiresPin: canViewContent(state),
      message: CLOSED_MESSAGES[state] ?? null,
    };
  }

  /** Correct PIN → the proposal (read-only once answered or closed). */
  async unlockEstimate(token: string, pin: string) {
    const e = await this.openWithPin(token, pin);
    await this.estimatesService.recordView(e._id, token);
    return this.presentEstimate(e);
  }

  /** Accept or decline, confirmed with the PIN again. */
  async answerEstimate(
    token: string,
    pin: string,
    answer: {
      decision: 'accepted' | 'declined';
      name?: string;
      reason?: string;
      acceptedTerms?: boolean;
      ip: string;
      userAgent: string;
    },
  ) {
    const e = await this.openWithPin(token, pin);
    const state = this.linkStateOf(e);
    if (state === 'responded') {
      throw new ConflictException({
        code: 'ALREADY_ANSWERED',
        message: 'This proposal was already answered.',
      });
    }
    if (state !== 'open') {
      throw new BadRequestException({
        code: 'NOT_OPEN',
        message:
          'This proposal can no longer be answered online. Please contact MEAN Consultors.',
      });
    }
    const at = await this.estimatesService.recordClientDecision(
      e,
      token,
      answer,
    );
    if (!at) {
      // Lost a race (double click, Helm changed it at the same moment).
      throw new ConflictException({
        code: 'ALREADY_ANSWERED',
        message: 'This proposal was already answered.',
      });
    }
    await this.notify(
      answer.decision === 'accepted'
        ? 'estimate.client_accepted'
        : 'estimate.client_declined',
      e,
      {
        decision: {
          name: answer.name ?? '',
          reason: answer.reason ?? '',
          at: at.toISOString(),
          ip: answer.ip,
        },
      },
    );
    const fresh = await this.estimatesService.findByShareToken(token);
    return this.presentEstimate(fresh);
  }

  /**
   * Loads the link and checks the PIN. Closed links (revoked, locked,
   * expired) refuse before the PIN is even checked, so a locked link cannot
   * keep being guessed. A wrong PIN counts toward the lock.
   */
  private async openWithPin(
    token: string,
    pin: string,
  ): Promise<EstimateDocument> {
    const e = await this.estimatesService.findByShareToken(token);
    const state = this.linkStateOf(e);
    if (!canViewContent(state)) {
      throw this.closedError(state);
    }
    if (verifyPin(pin, e.sharePinHash)) {
      return e;
    }
    const { attemptsLeft, lockedNow } =
      await this.estimatesService.recordWrongPin(e._id, token);
    if (lockedNow) {
      await this.notify('estimate.share_locked', e, {});
    }
    if (attemptsLeft <= 0) {
      throw this.closedError('locked');
    }
    // 403, not 401: the portal treats 401 as "your Helm session expired".
    throw new ForbiddenException({
      code: 'WRONG_PIN',
      message:
        attemptsLeft === 1
          ? 'Wrong PIN. 1 attempt left before this link is locked.'
          : `Wrong PIN. ${attemptsLeft} attempts left.`,
      attemptsLeft,
    });
  }

  private linkStateOf(e: EstimateDocument): ShareLinkState {
    // A link created before PINs existed cannot be opened at all.
    if (!e.sharePinHash) return 'revoked';
    return shareLinkState(e);
  }

  private closedError(state: ShareLinkState): HttpException {
    const body = {
      code: `LINK_${state.toUpperCase()}`,
      message: CLOSED_MESSAGES[state] ?? 'This link is no longer valid.',
    };
    if (state === 'locked') return new HttpException(body, HttpStatus.LOCKED);
    return new GoneException(body);
  }

  private presentEstimate(e: EstimateDocument) {
    const client = e.clientId as { name?: string } | null;
    const service = e.serviceId as { name?: string } | null;
    const state = this.linkStateOf(e);
    return {
      state,
      canRespond: state === 'open',
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
      expiresAt: linkExpiresAt(e.validUntil),
      sentAt: e.sentAt ?? null,
      decision: e.clientDecision
        ? {
            decision: e.clientDecision,
            at: e.clientDecisionAt ?? null,
            name: e.clientDecisionName ?? '',
          }
        : null,
      // Never expose: notes (internal), createdBy, updatedBy, shareToken,
      // PIN hash, attempts, IPs, IDs.
    };
  }

  /** Best effort: an email problem must never undo the client's answer. */
  private async notify(
    eventKey: string,
    e: EstimateDocument,
    extra: Record<string, unknown>,
  ) {
    const client = e.clientId as {
      _id?: unknown;
      name?: string;
      email?: string;
    } | null;
    try {
      await this.notifications.dispatch({
        eventKey,
        contextRef: `estimate:${e._id.toString()}`,
        dedupeKey: `${eventKey}:${e._id.toString()}:${e.shareCreatedAt?.getTime() ?? 0}`,
        context: {
          client: { name: client?.name ?? '', email: client?.email ?? '' },
          estimate: {
            id: e._id.toString(),
            title: e.title ?? 'Proposal',
            amount: e.amount,
            currency: e.currency,
            billingPeriod: e.billingPeriod,
          },
          ...extra,
        },
      });
    } catch (err) {
      this.logger.error(
        `Notification ${eventKey} failed for estimate ${e._id.toString()}: ${(err as Error).message}`,
      );
    }
  }

  async getSharedProject(token: string) {
    const { project, tasks } =
      await this.projectsService.findByShareToken(token);
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
