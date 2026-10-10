import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersModule } from '../users/users.module';
import { McpAuthService } from './mcp-auth.service';
import { McpCatalogController } from './mcp-catalog.controller';
import { McpCatalogService } from './mcp-catalog.service';
import { McpController } from './mcp.controller';
import { McpDispatcherService } from './mcp-dispatcher.service';

@Module({
  imports: [UsersModule, JwtModule.register({})],
  controllers: [McpController, McpCatalogController],
  providers: [McpAuthService, McpCatalogService, McpDispatcherService],
  exports: [McpCatalogService],
})
export class McpModule {}
