import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { Request } from 'express';
import { clientIp } from '../estimates/share-link';
import {
  AcceptEstimateDto,
  DeclineEstimateDto,
  EstimatePinDto,
} from './dto/estimate-link.dto';
import { PublicService } from './public.service';

/**
 * Public, unauthenticated portal endpoints for client-facing share links.
 *
 * NO JwtAuthGuard. Tokens are 256-bit random; revoked or invalid tokens
 * surface a 404 via the underlying service. Estimate links also need the
 * link's 6-digit PIN to show anything or to answer (see share-link.ts).
 * Request bodies (the PIN) are never logged.
 */
@ApiExcludeController()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  /** Whether the link opens; no proposal content before the PIN. */
  @Get('estimates/:token')
  getSharedEstimate(@Param('token') token: string) {
    return this.publicService.getEstimateLinkState(token);
  }

  @Post('estimates/:token/unlock')
  @HttpCode(200)
  unlockEstimate(@Param('token') token: string, @Body() dto: EstimatePinDto) {
    return this.publicService.unlockEstimate(token, dto.pin);
  }

  @Post('estimates/:token/accept')
  @HttpCode(200)
  acceptEstimate(
    @Param('token') token: string,
    @Body() dto: AcceptEstimateDto,
    @Req() req: Request,
  ) {
    return this.publicService.answerEstimate(token, dto.pin, {
      decision: 'accepted',
      name: dto.name.trim(),
      acceptedTerms: dto.acceptTerms === true,
      ...this.requestFacts(req),
    });
  }

  @Post('estimates/:token/decline')
  @HttpCode(200)
  declineEstimate(
    @Param('token') token: string,
    @Body() dto: DeclineEstimateDto,
    @Req() req: Request,
  ) {
    return this.publicService.answerEstimate(token, dto.pin, {
      decision: 'declined',
      reason: dto.reason?.trim() || undefined,
      ...this.requestFacts(req),
    });
  }

  @Get('projects/:token')
  getSharedProject(@Param('token') token: string) {
    return this.publicService.getSharedProject(token);
  }

  private requestFacts(req: Request) {
    return {
      ip: clientIp(req.headers['x-forwarded-for'], req.socket?.remoteAddress),
      userAgent: String(req.headers['user-agent'] ?? ''),
    };
  }
}
