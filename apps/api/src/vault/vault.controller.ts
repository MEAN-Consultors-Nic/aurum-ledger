import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RequestUser } from '../common/types/request-user.type';
import { CreateVaultEntryDto, UpdateVaultEntryDto } from './dto/vault-entry.dto';
import { AccessContext, ListOptions, VaultService } from './vault.service';
import { VaultCategory } from './schemas/vault-entry.schema';

@ApiTags('vault')
@ApiBearerAuth()
@Controller('vault')
@UseGuards(JwtAuthGuard)
export class VaultController {
  constructor(private readonly vault: VaultService) {}

  @Get()
  list(
    @Query('q') q?: string,
    @Query('category') category?: VaultCategory,
    @Query('tag') tag?: string,
    @Query('favorite') favorite?: string,
    @Query('parentType') parentType?: string,
    @Query('parentId') parentId?: string,
  ) {
    const opts: ListOptions = {
      q,
      category,
      tag,
      favorite: favorite === 'true',
      parentType,
      parentId,
    };
    return this.vault.list(opts);
  }

  @Get('categories')
  categoryCounts() {
    return this.vault.categoryCounts();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.vault.findOne(id);
  }

  @Post(':id/reveal')
  reveal(@Param('id') id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.vault.reveal(id, this.contextFor(user, req));
  }

  @Get(':id/audit')
  audit(@Param('id') id: string, @Query('limit') limit?: string) {
    return this.vault.auditFor(id, limit ? Number(limit) : undefined);
  }

  @Post()
  create(
    @Body() dto: CreateVaultEntryDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.vault.create(dto, this.contextFor(user, req));
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateVaultEntryDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    return this.vault.update(id, dto, this.contextFor(user, req));
  }

  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: RequestUser, @Req() req: Request) {
    return this.vault.remove(id, this.contextFor(user, req));
  }

  private contextFor(user: RequestUser | undefined, req: Request): AccessContext {
    return {
      userId: user?._id,
      ip:
        (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
        req.ip,
      userAgent: req.headers['user-agent'],
    };
  }
}
