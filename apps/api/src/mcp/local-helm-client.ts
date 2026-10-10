import { McpCatalogService } from './mcp-catalog.service';
import { McpDispatcherService } from './mcp-dispatcher.service';
import { McpIdentity } from './mcp-auth.service';
import { HelmCallInput, HelmCallResult, HelmClient, HelmOperation } from './mcp.types';

/** HelmClient backed by the running Nest app (used by the HTTP transport). */
export class LocalHelmClient implements HelmClient {
  constructor(
    private readonly catalog: McpCatalogService,
    private readonly dispatcher: McpDispatcherService,
    private readonly identity: McpIdentity,
  ) {}

  async whoami() {
    return {
      user: {
        id: this.identity.userId,
        name: this.identity.name,
        email: this.identity.email,
        role: this.identity.role,
      },
      authenticatedVia: this.identity.via,
      platform: 'Helm — MEAN Consultors operations platform',
      resources: this.catalog.resources(),
      operationCount: this.catalog.all().length,
      hint: 'Use helm_operations to browse, helm_describe to read a signature, helm_call to execute.',
    };
  }

  async listOperations(filter?: { resource?: string; query?: string; limit?: number }) {
    const limit = Math.min(Math.max(filter?.limit ?? 80, 1), 400);
    const needle = filter?.query?.toLowerCase();
    const all = this.catalog.all();

    const matches = all.filter((op) => {
      if (filter?.resource && op.resource.toLowerCase() !== filter.resource.toLowerCase()) return false;
      if (!needle) return true;
      return `${op.id} ${op.path} ${op.summary ?? ''}`.toLowerCase().includes(needle);
    });

    return {
      total: matches.length,
      resources: this.catalog.resources(),
      operations: matches.slice(0, limit).map((op) => ({
        id: op.id,
        method: op.method,
        path: op.path,
        summary: op.summary,
        readOnly: op.readOnly,
        destructive: op.destructive,
      })),
    };
  }

  async describeOperation(id: string): Promise<HelmOperation> {
    return this.catalog.find(id);
  }

  async call(input: HelmCallInput): Promise<HelmCallResult> {
    return this.dispatcher.call(input, this.identity.apiToken);
  }
}
