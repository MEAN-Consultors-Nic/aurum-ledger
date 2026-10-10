import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { HELM_TOOLS, handleHelmTool } from './mcp-tools';
import { HelmClient } from './mcp.types';

export const MCP_SERVER_INFO = {
  name: 'helm',
  version: '1.0.0',
};

export const MCP_INSTRUCTIONS = `Helm is MEAN Consultors' internal operations platform: clients, services, site audits, estimates, contracts, projects and tasks, payments, accounts, transactions, budgets, planned income, recurring expenses, loans, subscriptions, net worth, reports, site monitoring, a secrets vault and a notification center.

The whole REST API is exposed through four tools instead of one tool per endpoint:
  1. helm_whoami — who you are acting as and which resources exist.
  2. helm_operations — find the operation id you need.
  3. helm_describe — read its parameters and body schema.
  4. helm_call — run it.
helm_search and helm_fetch are shortcuts for turning a name into an id and reading one record.

Rules: amounts are in USD or NIO and the two are never mixed implicitly; ids are MongoDB ObjectIds, so resolve names with helm_search first; destructive operations require confirm: true and the user's explicit approval; never reveal vault secrets unless the user asked for that specific secret.`;

/** Builds a fresh MCP server bound to one caller's Helm client. */
export function createHelmMcpServer(client: HelmClient): Server {
  const server = new Server(MCP_SERVER_INFO, {
    capabilities: { tools: {} },
    instructions: MCP_INSTRUCTIONS,
  });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: HELM_TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleHelmTool(client, request.params.name, (request.params.arguments ?? {}) as Record<string, any>),
  );

  return server;
}
