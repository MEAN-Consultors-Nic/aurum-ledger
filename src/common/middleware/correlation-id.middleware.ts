import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';

const HEADER_NAME = 'x-correlation-id';

export function correlationIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const incoming = req.header(HEADER_NAME);
  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();
  req.headers[HEADER_NAME] = correlationId;
  res.setHeader(HEADER_NAME, correlationId);
  next();
}
