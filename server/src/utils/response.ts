import { Response } from 'express';

interface SuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
  };
}

interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export function sendSuccess<T>(res: Response, data: T, statusCode = 200, meta?: SuccessResponse['meta']) {
  const body: SuccessResponse<T> = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

export function sendError(res: Response, code: string, message: string, statusCode = 400) {
  const body: ErrorResponse = { success: false, error: { code, message } };
  return res.status(statusCode).json(body);
}
