import { NextFunction, Request, Response } from 'express';
import { ZodType } from 'zod';
import { AppError } from '../errors/AppError.js';

export function validateBody(schema: ZodType) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new AppError('Invalid request body', 400, result.error.flatten()));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery(schema: ZodType) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new AppError('Invalid query parameters', 400, result.error.flatten()));
      return;
    }
    res.locals.query = result.data;
    next();
  };
}
