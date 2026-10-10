import { HelmClient } from './mcp.types';

const MAX_CHARS = 60000;

export type McpToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
};

export const HELM_TOOLS: McpToolDefinition[] = [
  {
    name: 'helm_whoami',
    description:
      'Who the agent is acting as in Helm (user, role) plus a short map of the available resources. Call this first in a new conversation.',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'helm_operations',
    description:
      'List the Helm operations the agent can run. Every REST endpoint of the platform is exposed here as an operation id like "clients.findAll" or "estimates.convert". Filter by resource or free-text query to find what you need before calling helm_describe.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: {
          type: 'string',
          description: 'Restrict to one resource, e.g. clients, contracts, projects, transactions, siteAudit, vault.',
        },
        query: {
          type: 'string',
          description: 'Free-text match against the operation id, path and summary, e.g. "payment", "share", "occurrence".',
        },
        limit: { type: 'number', description: 'Max operations to return (default 80).' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'helm_describe',
    description:
      'Full signature of one operation: HTTP method, path, path/query parameters and the JSON schema of the request body. Always call this before helm_call on an operation you have not used yet in this conversation.',
    inputSchema: {
      type: 'object',
      properties: { operation: { type: 'string', description: 'Operation id, e.g. "contracts.create".' } },
      required: ['operation'],
      additionalProperties: false,
    },
  },
  {
    name: 'helm_call',
    description:
      'Run a Helm operation. Pass path parameters in "path", query string filters in "query" and the JSON payload in "body", exactly as helm_describe reports them. Destructive operations (deletes, voids, cancellations, resets, omissions, vault reveals, reconcile fixes) are refused unless confirm is true, so ask the user before setting it.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', description: 'Operation id, e.g. "payments.create".' },
        path: {
          type: 'object',
          description: 'Path parameters by name, e.g. {"id": "66f0..."}.',
          additionalProperties: { type: ['string', 'number'] },
        },
        query: { type: 'object', description: 'Query string parameters by name.', additionalProperties: true },
        body: { description: 'JSON request body for POST/PATCH/PUT operations.' },
        confirm: {
          type: 'boolean',
          description: 'Set to true only after the user has explicitly approved a destructive operation.',
        },
      },
      required: ['operation'],
      additionalProperties: false,
    },
  },
  {
    name: 'helm_search',
    description:
      'Global search across Helm (the same index behind the Cmd+K palette): clients, contracts, estimates, projects and more. Use it to turn a name the user mentioned into an id.',
    inputSchema: {
      type: 'object',
      properties: {
        q: { type: 'string', description: 'What to search for, e.g. a client name.' },
        limit: { type: 'number', description: 'Max results (default 20).' },
      },
      required: ['q'],
      additionalProperties: false,
    },
  },
  {
    name: 'helm_fetch',
    description:
      'Fetch one record by resource and id, e.g. resource "clients" and the id returned by helm_search. Shortcut for helm_call on the resource findOne operation.',
    inputSchema: {
      type: 'object',
      properties: {
        resource: { type: 'string', description: 'Resource name, e.g. clients, contracts, projects.' },
        id: { type: 'string', description: 'Record id.' },
      },
      required: ['resource', 'id'],
      additionalProperties: false,
    },
  },
];

function render(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
  if (text.length <= MAX_CHARS) return text;
  return (
    text.slice(0, MAX_CHARS) +
    `\n\n…truncated at ${MAX_CHARS} characters. Narrow the request with filters, a smaller "limit" or a specific id.`
  );
}

export async function handleHelmTool(
  client: HelmClient,
  name: string,
  args: Record<string, any>,
): Promise<{ content: { type: 'text'; text: string }[]; isError?: boolean }> {
  const ok = (value: unknown) => ({ content: [{ type: 'text' as const, text: render(value) }] });

  try {
    switch (name) {
      case 'helm_whoami':
        return ok(await client.whoami());

      case 'helm_operations':
        return ok(
          await client.listOperations({
            resource: args.resource,
            query: args.query,
            limit: args.limit,
          }),
        );

      case 'helm_describe':
        return ok(await client.describeOperation(String(args.operation)));

      case 'helm_search': {
        const result = await client.call({
          operation: 'search.search',
          query: { q: args.q, limit: args.limit ?? 20 },
        });
        return ok(result.data);
      }

      case 'helm_fetch': {
        const resource = String(args.resource);
        const candidates = [`${resource}.findOne`, `${resource}.findById`, `${resource}.get`];
        let lastError: unknown;
        for (const candidate of candidates) {
          try {
            const result = await client.call({ operation: candidate, path: { id: String(args.id) } });
            return ok(result.data);
          } catch (error) {
            lastError = error;
          }
        }
        throw lastError ?? new Error(`No single-record operation found for resource "${resource}".`);
      }

      case 'helm_call': {
        const result = await client.call({
          operation: String(args.operation),
          path: args.path,
          query: args.query,
          body: args.body,
          confirm: args.confirm === true,
        });
        if (!result.ok) {
          return {
            content: [
              {
                type: 'text' as const,
                text: render({
                  error: `Helm API returned ${result.status}`,
                  details: result.data,
                }),
              },
            ],
            isError: true,
          };
        }
        return ok(result.data);
      }

      default:
        return {
          content: [{ type: 'text' as const, text: `Unknown tool "${name}".` }],
          isError: true,
        };
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text' as const,
          text: render({ error: error?.message ?? String(error), details: error?.response ?? undefined }),
        },
      ],
      isError: true,
    };
  }
}
