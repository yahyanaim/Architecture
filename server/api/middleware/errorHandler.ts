import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/exceptions/AppError';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { StatusCodes } from 'http-status-codes';
import { reportError } from '../../infrastructure/observability';

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void => {
  console.error('[Error]', err);

  if (err instanceof ValidationException) {
    res.status(err.statusCode).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
    });
    return;
  }

  if (err instanceof AppError) {
    // Operational (4xx) errors are expected client faults — logged, not paged.
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
    return;
  }

  // Unexpected 5xx: structured report (log + optional webhook/Sentry-style
  // ingest) with request context, generic body to the client (no leak).
  reportError(err, { url: _req.url, method: _req.method, requestId: (_req as any).requestId });
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};
