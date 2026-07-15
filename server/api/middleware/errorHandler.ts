import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/exceptions/AppError';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { StatusCodes } from 'http-status-codes';

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
    res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
    return;
  }

  // fallback
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};
