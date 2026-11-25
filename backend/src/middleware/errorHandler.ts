import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError('Resource not found', 404));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const isAppError = err instanceof AppError;
  const statusCode = isAppError ? err.statusCode : 500;

  if (!isAppError) {
    console.error('Unhandled server error:', err instanceof Error ? err.name : 'Unknown error');
  }

  res.status(statusCode).json({
    error: isAppError ? err.message : 'Internal server error',
    details: isAppError ? err.details : undefined,
  });
}
