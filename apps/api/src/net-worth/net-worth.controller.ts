import {
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { NetWorthService } from './net-worth.service';

@ApiTags('net-worth')
@ApiBearerAuth()
@Controller('net-worth')
@UseGuards(JwtAuthGuard)
export class NetWorthController {
  constructor(private readonly netWorthService: NetWorthService) {}

  @Get('current')
  async current() {
    const current = await this.netWorthService.computeCurrent();
    const deltas = await this.netWorthService.deltas(current.netWorthUsd);
    return { ...current, deltas };
  }

  @Get('history')
  history(@Query('days', new DefaultValuePipe(90), ParseIntPipe) days: number) {
    return this.netWorthService.history(days);
  }

  @Post('snapshot')
  snapshot() {
    return this.netWorthService.snapshot();
  }
}
