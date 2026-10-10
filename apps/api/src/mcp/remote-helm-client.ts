import { HelmCallInput, HelmCallResult, HelmClient, HelmOperation } from './mcp.types';

type RemoteOptions = {
  baseUrl: string;
  token: string;
  email?: string;
  password?: string;
};

/**
 * HelmClient that talks to a deployed Helm over HTTPS. Used by the stdio
 * bridge so Claude Code and Claude Desktop get exactly the same tools as the
 * remote HTTP transport, without running the API locally.
 */
export class RemoteHelmClient implements HelmClient {
  private operations: HelmOperation[] | null = null;
  private resourceList: string[] = [];
  private token: string;

  constructor(private readonly options: RemoteOptions) {
    this.token = options.token;
  }

  private get apiBase(): string {
    const base = this.options.baseUrl.replace(/\/$/, '');
    return base.endsWith('/api/v1') ? base : `${base}/api/v1`;
  }

  private async request(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
    const response = await fetch(`${this.apiBase}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: 'application/json',
        ...(init.headers ?? {}),
      },
    });

    if (response.status === 401 && retry && this.options.email && this.options.password) {
      await this.login();
      return this.request(path, init, false);
    }
    return response;
  }

  private async login(): Promise<void> {
    const response = await fetch(`${this.apiBase}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: this.options.email,
        password: this.options.password,
      }),
    });
    if (!response.ok) {
      throw new Error(`Helm login failed (${response.status}). Check HELM_EMAIL / HELM_PASSWORD.`);
    }
    const data = (await response.json()) as { accessToken: string };
    this.token = data.accessToken;
  }

  private async loadCatalog(): Promise<HelmOperation[]> {
    if (this.operations) return this.operations;
    const response = await this.request('/mcp-catalog');
    if (!response.ok) {
      throw new Error(
        `Could not load the Helm operation catalog (${response.status}). Is HELM_API_URL correct and the token valid?`,
      );
    }
    const data = (await response.json()) as { operations: HelmOperation[]; resources: string[] };
    this.operations = data.operations;
    this.resourceList = data.resources;
    return this.operations;
  }

  async whoami() {
    await this.loadCatalog();
    return {
      platform: 'Helm — MEAN Consultors operations platform',
      endpoint: this.apiBase,
      resources: this.resourceList,
      operationCount: this.operations?.length ?? 0,
      hint: 'Use helm_operations to browse, helm_describe to read a signature, helm_call to execute.',
    };
  }

  async listOperations(filter?: { resource?: string; query?: string; limit?: number }) {
    const all = await this.loadCatalog();
    const limit = Math.min(Math.max(filter?.limit ?? 80, 1), 400);
    const needle = filter?.query?.toLowerCase();

    const matches = all.filter((op) => {
      if (filter?.resource && op.resource.toLowerCase() !== filter.resource.toLowerCase()) return false;
      if (!needle) return true;
      return `${op.id} ${op.path} ${op.summary ?? ''}`.toLowerCase().includes(needle);
    });

    return {
      total: matches.length,
      resources: this.resourceList,
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

  private async resolve(id: string): Promise<HelmOperation> {
    const all = await this.loadCatalog();
    const exact = all.find((op) => op.id === id);
    if (exact) return exact;

    const [resource, action = ''] = id.split('.');
    const ops = all.filter((op) => op.resource.toLowerCase() === resource?.toLowerCase());
    const byId = (method: string) => ops.find((op) => op.method === method && op.pathParams.length === 1);
    const collection = (method: string) => ops.find((op) => op.method === method && op.pathParams.length === 0);

    const alias: Record<string, HelmOperation | undefined> = {
      get: byId('GET'),
      findone: byId('GET'),
      findbyid: byId('GET'),
      list: collection('GET'),
      findall: collection('GET'),
      search: collection('GET'),
      create: collection('POST'),
      update: byId('PATCH') ?? byId('PUT'),
      remove: byId('DELETE'),
      delete: byId('DELETE'),
      softdelete: byId('DELETE'),
    };

    const match = alias[action.toLowerCase()] ?? ops.find((op) => op.action.toLowerCase() === action.toLowerCase());
    if (!match) {
      const suggestions = ops.slice(0, 8).map((op) => op.id).join(', ');
      throw new Error(
        `Unknown operation "${id}".${suggestions ? ` Available for "${resource}": ${suggestions}` : ' Use helm_operations to list them.'}`,
      );
    }
    return match;
  }

  async describeOperation(id: string): Promise<HelmOperation> {
    return this.resolve(id);
  }

  async call(input: HelmCallInput): Promise<HelmCallResult> {
    const op = await this.resolve(input.operation);

    if (op.destructive && input.confirm !== true) {
      throw new Error(
        `Operation "${op.id}" is destructive (${op.method} ${op.path}). Re-send it with confirm: true once the user has agreed.`,
      );
    }

    let path = op.path.replace(/^\/api\/v1/, '');
    for (const param of op.pathParams) {
      const value = input.path?.[param.name];
      if (value === undefined || value === null || value === '') {
        throw new Error(`Missing path parameter "${param.name}" for ${op.id}.`);
      }
      path = path.replace(`{${param.name}}`, encodeURIComponent(String(value)));
    }

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(input.query ?? {})) {
      if (value === undefined || value === null || value === '') continue;
      search.set(key, String(value));
    }
    const qs = search.toString();
    const hasBody = !['GET', 'DELETE'].includes(op.method) && input.body !== undefined;

    const response = await this.request(`${path}${qs ? `?${qs}` : ''}`, {
      method: op.method,
      headers: hasBody ? { 'Content-Type': 'application/json' } : {},
      body: hasBody ? JSON.stringify(input.body) : undefined,
    });

    const text = await response.text();
    let data: unknown = text;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      /* non-JSON response */
    }

    return { status: response.status, ok: response.ok, data };
  }
}
