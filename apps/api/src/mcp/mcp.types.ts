export type HelmParam = {
  name: string;
  required: boolean;
  description?: string;
  schema: Record<string, unknown>;
};

export type HelmOperation = {
  /** Stable id used by agents, e.g. "clients.findAll" */
  id: string;
  resource: string;
  action: string;
  method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  /** Path template including the global prefix, e.g. /api/v1/clients/{id} */
  path: string;
  summary?: string;
  pathParams: HelmParam[];
  queryParams: HelmParam[];
  bodySchema?: Record<string, unknown>;
  readOnly: boolean;
  destructive: boolean;
};

export type HelmCallInput = {
  operation: string;
  path?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  confirm?: boolean;
};

export type HelmCallResult = {
  status: number;
  ok: boolean;
  data: unknown;
};

/**
 * Everything the MCP tools need. Implemented twice: in-process (inside the
 * Nest app) and over HTTP (the stdio bridge), so both transports share one
 * tool implementation.
 */
export interface HelmClient {
  listOperations(filter?: { resource?: string; query?: string; limit?: number }): Promise<{
    total: number;
    resources: string[];
    operations: Pick<HelmOperation, 'id' | 'method' | 'path' | 'summary' | 'readOnly' | 'destructive'>[];
  }>;
  describeOperation(id: string): Promise<HelmOperation>;
  call(input: HelmCallInput): Promise<HelmCallResult>;
  whoami(): Promise<unknown>;
}
