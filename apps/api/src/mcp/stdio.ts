#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createHelmMcpServer } from './mcp-server.factory';
import { RemoteHelmClient } from './remote-helm-client';

/**
 * stdio entry point for Claude Code and Claude Desktop.
 *
 *   HELM_API_URL   https://helm-core.meanconsultors.com   (or http://localhost:3113)
 *   HELM_TOKEN     a Helm access token, or MCP_SERVICE_TOKEN
 *   HELM_EMAIL     optional — with HELM_PASSWORD, logs in and refreshes on 401
 *   HELM_PASSWORD
 */
async function main() {
  const baseUrl = process.env.HELM_API_URL ?? 'http://localhost:3113';
  const token = process.env.HELM_TOKEN ?? '';
  const email = process.env.HELM_EMAIL;
  const password = process.env.HELM_PASSWORD;

  if (!token && !(email && password)) {
    process.stderr.write(
      'helm-mcp: set HELM_TOKEN, or HELM_EMAIL and HELM_PASSWORD, before starting the server.\n',
    );
    process.exit(1);
  }

  const client = new RemoteHelmClient({ baseUrl, token, email, password });
  const server = createHelmMcpServer(client);
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write(`helm-mcp: connected to ${baseUrl}\n`);
}

main().catch((error) => {
  process.stderr.write(`helm-mcp: fatal — ${(error as Error).message}\n`);
  process.exit(1);
});
