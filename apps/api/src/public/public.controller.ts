import { Controller, Get, Param } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { PublicService } from './public.service';

/**
 * Public, unauthenticated portal endpoints for client-facing share links.
 *
 * NO JwtAuthGuard. Tokens are 256-bit random; revoked or invalid tokens
 * surface a 404 via the underlying service.
 */
@ApiExcludeController()
@Controller('public')
export class PublicController {
  constructor(private readonly publicService: PublicService) {}

  @Get('estimates/:token')
  getSharedEstimate(@Param('token') token: string) {
    return this.publicService.getSharedEstimate(token);
  }

  @Get('projects/:token')
  getSharedProject(@Param('token') token: string) {
    return this.publicService.getSharedProject(token);
  }
}
