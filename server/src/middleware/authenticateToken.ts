import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config';

export type AuthUser = {
  id: number;
  username: string;
};

export const authenticateToken = (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.sendStatus(401);

  jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }, (err: any, user: any) => {
    if (err) return res.sendStatus(403);
    req.user = user as AuthUser;
    next();
  });
};
