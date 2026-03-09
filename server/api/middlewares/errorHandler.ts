import { Request, Response, NextFunction } from 'express';
import { AppError } from '../../domain/exceptions/AppError';
import { ValidationException } from '../../domain/exceptions/ValidationException';
import { StatusCodes } from 'http-status-codes';

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error('[Error]', err);

  if (err instanceof ValidationException) {
    return res.status(err.statusCode).json({
      error: 'Validation Error',
      message: err.message,
      details: err.errors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    });
  }

  // fallback
  res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
};
