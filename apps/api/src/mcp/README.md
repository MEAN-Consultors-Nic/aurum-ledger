# Helm MCP server

Exposes the **entire** Helm REST API to AI agents over the Model Context
Protocol, from Claude Code, Claude Desktop and ChatGPT.

## Why six tools instead of 204

The API has 204 endpoints. One MCP tool per endpoint would blow past what any
client can hold in context (both Claude and ChatGPT degrade well before that),
and every new endpoint would need a new tool by hand.

Instead the catalog is **derived at runtime from the OpenAPI document** that
NestJS already builds for `/api/docs`, and agents reach it through six tools:

| Tool | What it does |
| --- | --- |
| `helm_whoami` | Identity, role and the list of resources |
| `helm_operations` | Browse/filter the 204 operations |
| `helm_describe` | Method, path, params and body JSON Schema of one operation |
| `helm_call` | Execute an operation |
| `helm_search` | Global search (the Cmd+K index) — name → id |
| `helm_fetch` | Read one record by resource + id |

Consequences worth knowing:

- **New endpoints appear automatically.** Add a controller route, rebuild, and
  the agent can use it. Nothing to register here.
- **Schemas come from the DTOs.** The `@nestjs/swagger` CLI plugin is enabled in
  `nest-cli.json`, so `class-validator` rules (`@MinLength`, `@IsEmail`, enums)
  become real JSON Schema the agent reads before calling.
- **Business rules are never bypassed.** `helm_call` goes through the app's own
  HTTP layer, so guards, `ValidationPipe` and every service rule apply exactly
  as they do for the Angular app.

## Safety rails

- Destructive operations (deletes, soft-deletes, voids, cancellations, balance
  resets, occurrence omissions, `vault.reveal`, `reconcile.fix`) are refused
  unless the call carries `confirm: true`, so the agent has to come back to the
  user first.
- `MCP_ALLOW` / `MCP_DENY` take globs over operation ids and are applied before
  anything is listed or executed. To keep money and secrets out of reach:
  `MCP_DENY=vault.*,payments.*,transactions.*,users.*,reconcile.*`
- Every call is logged with its operation id, status and duration.
- The agent is always *a Helm user*: `staff` tokens hit the same `RolesGuard`
  restrictions as in the web app.

## Transports

### Remote (streamable HTTP) — required for ChatGPT

```
POST https://helm-core.meanconsultors.com/api/v1/mcp
Authorization: Bearer <token>
```

`<token>` is either a normal Helm access token or `MCP_SERVICE_TOKEN`. For
clients that cannot send headers there is a path variant,
`/api/v1/mcp/t/<token>` — avoid it when you have a choice, since URLs end up in
logs and browser history.

### stdio — Claude Code and Claude Desktop

`node apps/api/dist/mcp/stdio.js`, configured with:

| Variable | Meaning |
| --- | --- |
| `HELM_API_URL` | `https://helm-core.meanconsultors.com` or `http://localhost:3113` |
| `HELM_TOKEN` | Helm access token or `MCP_SERVICE_TOKEN` |
| `HELM_EMAIL` / `HELM_PASSWORD` | Optional: log in and refresh automatically on 401 |

The stdio bridge pulls the same catalog from `GET /api/v1/mcp-catalog`, so both
transports always describe the same operations.

## Client setup

**Claude Code**

```bash
claude mcp add helm --env HELM_API_URL=https://helm-core.meanconsultors.com \
  --env HELM_TOKEN=xxx -- node /ruta/a/AURUM\ LEDGER/apps/api/dist/mcp/stdio.js
```

**Claude Desktop** — `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "helm": {
      "command": "node",
      "args": ["/ruta/a/AURUM LEDGER/apps/api/dist/mcp/stdio.js"],
      "env": {
        "HELM_API_URL": "https://helm-core.meanconsultors.com",
        "HELM_TOKEN": "xxx"
      }
    }
  }
}
```

**ChatGPT** — Settings → Connectors → create a custom connector pointing at
`https://helm-core.meanconsultors.com/api/v1/mcp`. ChatGPT only speaks to remote
MCP servers, never to a local process.

## Files

```
openapi-store.ts        the Swagger document, stashed by main.ts
mcp-catalog.service.ts  OpenAPI -> operations, aliases, allow/deny, destructive flags
mcp-dispatcher.service.ts  executes an operation over the app's own HTTP layer
mcp-tools.ts            the six tools, shared by both transports
mcp-server.factory.ts   builds an MCP server bound to one caller
mcp.controller.ts       streamable HTTP transport (stateless)
mcp-catalog.controller.ts  GET /api/v1/mcp-catalog for the stdio bridge
local-helm-client.ts    in-process client (HTTP transport)
remote-helm-client.ts   over-the-wire client (stdio bridge)
stdio.ts                stdio entry point
```
