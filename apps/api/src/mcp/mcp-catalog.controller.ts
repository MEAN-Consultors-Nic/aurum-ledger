import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { McpCatalogService } from './mcp-catalog.service';

/**
 * The stdio bridge reads the catalog from here so both transports describe
 * exactly the same operations.
 */
@ApiExcludeController()
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('mcp-catalog')
export class McpCatalogController {
  constructor(private readonly catalog: McpCatalogService) {}

  @Get()
  list(@Query('resource') resource?: string, @Query('query') query?: string) {
    const needle = query?.toLowerCase();
    const operations = this.catalog.all().filter((op) => {
      if (resource && op.resource.toLowerCase() !== resource.toLowerCase()) return false;
      if (!needle) return true;
      return `${op.id} ${op.path} ${op.summary ?? ''}`.toLowerCase().includes(needle);
    });

    return {
      resources: this.catalog.resources(),
      total: operations.length,
      operations,
    };
  }
}
