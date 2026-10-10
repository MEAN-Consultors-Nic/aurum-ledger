import type { OpenAPIObject } from '@nestjs/swagger';

/**
 * The Swagger document is built in main.ts (HTTP mode). The MCP layer consumes
 * it as the single source of truth for the tool catalog, so every endpoint the
 * REST API exposes is automatically reachable by an agent — no hand-written
 * tool per endpoint, and new endpoints show up for free.
 */
let document: OpenAPIObject | null = null;

export function setOpenApiDocument(doc: OpenAPIObject) {
  document = doc;
}

export function getOpenApiDocument(): OpenAPIObject | null {
  return document;
}
