import { Request, Response, NextFunction } from 'express';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('[ErrorHandler Caught Exception]:', err);

  const status = err.status || err.statusCode || 500;
  const message = err.message || 'An unexpected server error occurred';

  res.status(status).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' ? { stack: err.stack } : {}),
  });
};
