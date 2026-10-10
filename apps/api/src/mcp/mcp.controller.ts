import {
  All,
  Controller,
  Logger,
  Param,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { McpAuthService } from './mcp-auth.service';
import { McpCatalogService } from './mcp-catalog.service';
import { McpDispatcherService } from './mcp-dispatcher.service';
import { LocalHelmClient } from './local-helm-client';
import { createHelmMcpServer } from './mcp-server.factory';

/**
 * Streamable HTTP transport, stateless: one short-lived server + transport per
 * request. Stateless keeps it safe behind Heroku's router and lets ChatGPT,
 * Claude Code and Claude Desktop all point at the same URL.
 *
 * Excluded from Swagger on purpose — it is not part of the REST surface and
 * including it would feed the catalog back into itself.
 */
@ApiExcludeController()
@Controller('mcp')
export class McpController {
  private readonly logger = new Logger(McpController.name);

  constructor(
    private readonly auth: McpAuthService,
    private readonly catalog: McpCatalogService,
    private readonly dispatcher: McpDispatcherService,
  ) {}

  @All()
  async handle(@Req() req: Request, @Res() res: Response) {
    return this.process(req, res, this.bearerFrom(req));
  }

  /**
   * Token-in-path variant for clients that cannot send an Authorization
   * header. Less safe than the header (URLs leak into logs and history), so
   * use it only when the client leaves no choice.
   */
  @All('t/:token')
  async handleWithPathToken(@Param('token') token: string, @Req() req: Request, @Res() res: Response) {
    return this.process(req, res, token);
  }

  private bearerFrom(req: Request): string | undefined {
    const header = req.headers.authorization;
    if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
    const apiKey = req.headers['x-api-key'];
    return typeof apiKey === 'string' ? apiKey : undefined;
  }

  private async process(req: Request, res: Response, token: string | undefined) {
    let identity;
    try {
      identity = await this.auth.resolve(token);
    } catch (error) {
      const message = error instanceof UnauthorizedException ? error.message : 'Unauthorized';
      res
        .status(401)
        .set('WWW-Authenticate', 'Bearer realm="helm-mcp"')
        .json({
          jsonrpc: '2.0',
          error: { code: -32001, message },
          id: null,
        });
      return;
    }

    const client = new LocalHelmClient(this.catalog, this.dispatcher, identity);
    const server = createHelmMcpServer(client);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });

    res.on('close', () => {
      void transport.close();
      void server.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      this.logger.error(`MCP request failed: ${(error as Error).message}`);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal MCP error' },
          id: null,
        });
      }
    }
  }
}
