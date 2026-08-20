import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { requestContextStorage } from './request-context';
import { AuditRequestContext } from './audit.types';

/**
 * Middleware that wraps each request in an AsyncLocalStorage context.
 * REQ-AUD-012 — generates request_id if not provided.
 * REQ-AUD-013 — propagates correlation_id.
 * REQ-AUD-014 — captures IP address from the request.
 * REQ-AUD-015 — captures user-agent.
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction) {
    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    const correlationId = (req.headers['x-correlation-id'] as string) || requestId;

    const context: AuditRequestContext = {
      requestId,
      correlationId,
      ipAddress: this.extractIp(req),
      userAgent: req.headers['user-agent'] || undefined,
      sessionId: undefined, // will be enriched after auth
    };

    requestContextStorage.run(context, () => {
      next();
    });
  }

  private extractIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
      return first.trim();
    }
    return req.ip || req.socket.remoteAddress || 'unknown';
  }
}
