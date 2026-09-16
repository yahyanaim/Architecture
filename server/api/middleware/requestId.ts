import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { runWithTraceContext } from '../../infrastructure/observability';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      traceId: string;
    }
  }
}

export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const incomingReqId = req.headers['x-request-id'] as string | undefined;
  const incomingTraceId = (req.headers['x-trace-id'] as string | undefined) || incomingReqId;
  const id = incomingReqId || crypto.randomUUID();
  const traceId = incomingTraceId || id;

  req.requestId = id;
  req.traceId = traceId;

  res.setHeader('x-request-id', id);
  res.setHeader('x-trace-id', traceId);

  runWithTraceContext({ traceId, requestId: id }, () => {
    next();
  });
};
