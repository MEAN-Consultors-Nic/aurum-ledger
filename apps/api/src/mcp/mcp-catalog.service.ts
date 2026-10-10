import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getOpenApiDocument } from './openapi-store';
import { HelmOperation, HelmParam } from './mcp.types';

const METHODS = ['get', 'post', 'patch', 'put', 'delete'] as const;

/** Operations that change or expose something sensitive need confirm: true. */
const DESTRUCTIVE_PATTERNS = [
  '*.remove*',
  '*.delete*',
  '*softDelete*',
  '*.void*',
  '*.cancel*',
  '*.reset*',
  '*.omit*',
  'vault.reveal',
  'reconcile.fix',
  'users.toggleActive',
  '*.revokeShare',
];

function matchGlob(pattern: string, value: string): boolean {
  const escaped = pattern
    .split('*')
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('.*');
  return new RegExp(`^${escaped}$`, 'i').test(value);
}

function matchAny(patterns: string[], value: string): boolean {
  return patterns.some((p) => matchGlob(p.trim(), value));
}

function kebabToCamelResource(controller: string): string {
  // "ClientsController" -> "clients", "NotificationsEngineController" -> "notificationsEngine"
  const base = controller.replace(/Controller$/, '');
  return base.charAt(0).toLowerCase() + base.slice(1);
}

@Injectable()
export class McpCatalogService {
  private readonly logger = new Logger(McpCatalogService.name);
  private cache: Map<string, HelmOperation> | null = null;

  constructor(private readonly config: ConfigService) {}

  private get allowList(): string[] {
    const raw = this.config.get<string>('MCP_ALLOW') ?? '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  private get denyList(): string[] {
    const raw = this.config.get<string>('MCP_DENY') ?? '';
    return raw.split(',').map((s) => s.trim()).filter(Boolean);
  }

  isAllowed(id: string): boolean {
    const deny = this.denyList;
    if (deny.length && matchAny(deny, id)) return false;
    const allow = this.allowList;
    if (allow.length && !matchAny(allow, id)) return false;
    return true;
  }

  private build(): Map<string, HelmOperation> {
    const doc = getOpenApiDocument();
    const map = new Map<string, HelmOperation>();
    if (!doc) {
      this.logger.warn('OpenAPI document not available — MCP catalog is empty');
      return map;
    }

    for (const [path, item] of Object.entries(doc.paths ?? {})) {
      for (const method of METHODS) {
        const op = (item as Record<string, any>)[method];
        if (!op) continue;

        const operationId: string = op.operationId ?? '';
        let resource: string;
        let action: string;
        if (operationId.includes('_')) {
          const [controller, handler] = operationId.split('_');
          resource = kebabToCamelResource(controller);
          action = handler;
        } else {
          resource = (path.split('/').filter(Boolean)[2] ?? 'root').replace(/[^a-z0-9]/gi, '');
          action = method + path.replace(/[^a-z0-9]/gi, '');
        }

        const id = `${resource}.${action}`;
        const params = (op.parameters ?? []) as any[];
        const toParam = (p: any): HelmParam => ({
          name: p.name,
          required: Boolean(p.required),
          description: p.description,
          schema: p.schema ?? { type: 'string' },
        });

        const requestSchema =
          op.requestBody?.content?.['application/json']?.schema ??
          op.requestBody?.content?.['multipart/form-data']?.schema;

        const readOnly = method === 'get';
        const destructive = method === 'delete' || matchAny(DESTRUCTIVE_PATTERNS, id);

        map.set(id, {
          id,
          resource,
          action,
          method: method.toUpperCase() as HelmOperation['method'],
          path,
          summary: op.summary || op.description || undefined,
          pathParams: params.filter((p) => p.in === 'path').map(toParam),
          queryParams: params.filter((p) => p.in === 'query').map(toParam),
          bodySchema: requestSchema ? this.resolveSchema(requestSchema, doc) : undefined,
          readOnly,
          destructive,
        });
      }
    }

    this.logger.log(`MCP catalog built with ${map.size} operations`);
    return map;
  }

  /** Inlines $ref components one level deep so agents see real field names. */
  private resolveSchema(schema: any, doc: any, depth = 0): Record<string, unknown> {
    if (!schema || depth > 4) return schema ?? {};
    if (schema.$ref) {
      const name = String(schema.$ref).split('/').pop() as string;
      const target = doc.components?.schemas?.[name];
      return target ? this.resolveSchema(target, doc, depth + 1) : { type: 'object' };
    }
    if (schema.type === 'array' && schema.items) {
      return { ...schema, items: this.resolveSchema(schema.items, doc, depth + 1) };
    }
    if (schema.properties) {
      const properties: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(schema.properties)) {
        properties[key] = this.resolveSchema(value, doc, depth + 1);
      }
      return { ...schema, properties };
    }
    return schema;
  }

  all(): HelmOperation[] {
    if (!this.cache) this.cache = this.build();
    return [...this.cache.values()].filter((op) => this.isAllowed(op.id));
  }

  /**
   * Agents guess names. Accept common aliases ("clients.get", "clients.list")
   * by matching on the resource plus the shape of the operation.
   */
  private resolveAlias(id: string): HelmOperation | undefined {
    const [resource, action] = id.split('.');
    if (!resource || !action) return undefined;
    const ops = [...(this.cache as Map<string, HelmOperation>).values()].filter(
      (op) => op.resource.toLowerCase() === resource.toLowerCase(),
    );
    if (!ops.length) return undefined;

    const byId = (method: HelmOperation['method']) =>
      ops.find((op) => op.method === method && op.pathParams.length === 1);
    const collection = (method: HelmOperation['method']) =>
      ops.find((op) => op.method === method && op.pathParams.length === 0);

    switch (action.toLowerCase()) {
      case 'get':
      case 'findone':
      case 'findbyid':
      case 'show':
        return byId('GET');
      case 'list':
      case 'findall':
      case 'search':
      case 'index':
        return collection('GET');
      case 'create':
      case 'add':
        return collection('POST');
      case 'update':
      case 'patch':
      case 'edit':
        return byId('PATCH') ?? byId('PUT');
      case 'remove':
      case 'delete':
      case 'softdelete':
        return byId('DELETE');
      default:
        return ops.find((op) => op.action.toLowerCase() === action.toLowerCase());
    }
  }

  find(id: string): HelmOperation {
    if (!this.cache) this.cache = this.build();
    const op = this.cache.get(id) ?? this.resolveAlias(id);
    if (!op) {
      const suggestions = this.all()
        .filter((candidate) => candidate.id.toLowerCase().includes(id.toLowerCase().split('.')[0]))
        .slice(0, 8)
        .map((candidate) => candidate.id);
      throw new NotFoundException(
        `Unknown operation "${id}".${suggestions.length ? ` Did you mean: ${suggestions.join(', ')}` : ' Use helm_operations to list them.'}`,
      );
    }
    if (!this.isAllowed(op.id)) {
      throw new NotFoundException(`Operation "${id}" is disabled by MCP_ALLOW/MCP_DENY policy.`);
    }
    return op;
  }

  resources(): string[] {
    return [...new Set(this.all().map((op) => op.resource))].sort();
  }

  reset() {
    this.cache = null;
  }
}
