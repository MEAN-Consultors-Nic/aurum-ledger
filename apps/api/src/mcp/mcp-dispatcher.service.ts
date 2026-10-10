import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { McpCatalogService } from './mcp-catalog.service';
import { HelmCallInput, HelmCallResult } from './mcp.types';

/**
 * Executes a catalog operation by calling the app's own REST API over
 * loopback HTTP. Going through the real HTTP layer means every guard,
 * ValidationPipe and business rule applies exactly as it does for the web
 * app — the agent cannot take a shortcut around them.
 */
@Injectable()
export class McpDispatcherService {
  private readonly logger = new Logger(McpDispatcherService.name);

  constructor(
    private readonly catalog: McpCatalogService,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    const explicit = this.config.get<string>('MCP_SELF_BASE_URL');
    if (explicit) return explicit.replace(/\/$/, '');
    const port = this.config.get<string>('PORT') ?? '3000';
    return `http://127.0.0.1:${port}`;
  }

  async call(input: HelmCallInput, apiToken: string): Promise<HelmCallResult> {
    const op = this.catalog.find(input.operation);

    if (op.destructive && input.confirm !== true) {
      throw new BadRequestException(
        `Operation "${op.id}" is destructive (${op.method} ${op.path}). Re-send it with confirm: true once the user has agreed.`,
      );
    }

    let path = op.path;
    for (const param of op.pathParams) {
      const value = input.path?.[param.name];
      if (value === undefined || value === null || value === '') {
        throw new BadRequestException(
          `Missing path parameter "${param.name}" for ${op.id}. Expected: ${op.pathParams.map((p) => p.name).join(', ')}`,
        );
      }
      path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    }
    const leftover = path.match(/\{([^}]+)\}/);
    if (leftover) {
      throw new BadRequestException(`Missing path parameter "${leftover[1]}" for ${op.id}.`);
    }

    const url = new URL(this.baseUrl + path);
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      url.searchParams.set(key, String(value));
    }

    const hasBody = !['GET', 'DELETE'].includes(op.method) && input.body !== undefined;
    const started = Date.now();

    const response = await fetch(url.toString(), {
      method: op.method,
      headers: {
        Authorization: `Bearer ${apiToken}`,
        Accept: 'application/json',
        ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
        'x-mcp-call': op.id,
      },
      body: hasBody ? JSON.stringify(input.body) : undefined,
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON response (e.g. a PDF) — keep raw text */
    }

    this.logger.log(
      `MCP ${op.id} ${op.method} ${url.pathname} -> ${response.status} in ${Date.now() - started}ms`,
    );

    return { status: response.status, ok: response.ok, data };
  }
}
