import type { NextFunction, Response } from 'express';

export const requireAdmin = (req: any, res: Response, next: NextFunction) => {
  if (req?.user?.username === 'admin') {
    return next();
  }
  return res.status(403).json({ error: 'Forbidden', code: 'FORBIDDEN' });
};
