import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { RequestUser } from '../common/types/request-user.type';
import { ReconcileService } from './reconcile.service';

@ApiTags('reconcile')
@ApiBearerAuth()
@Controller('reconcile')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class ReconcileController {
  constructor(private readonly reconcileService: ReconcileService) {}

  @Get('diagnose')
  diagnose() {
    return this.reconcileService.diagnose();
  }

  @Post('fix/:issueKey')
  fix(@Param('issueKey') issueKey: string, @CurrentUser() user: RequestUser) {
    return this.reconcileService.runFix(issueKey, user?._id);
  }
}
