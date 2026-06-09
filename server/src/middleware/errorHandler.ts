import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  console.error('[Error]', err.message);

  if (err instanceof ZodError) {
    const message = err.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return sendError(res, 'VALIDATION_ERROR', message, 400);
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      return sendError(res, 'NOT_FOUND', '记录不存在', 404);
    }
    if (err.code === 'P2002') {
      return sendError(res, 'CONFLICT', '记录已存在', 409);
    }
  }

  return sendError(res, 'INTERNAL_ERROR', '服务器内部错误', 500);
}
