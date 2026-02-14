import type { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, SERVER_SESSION_ID } from '../config';
import User from '../models/User';
import DeviceSession from '../models/DeviceSession';

export type AuthUser = {
  id: number;
  username: string;
  dsid?: string;
};

const lastSeenUpdate = new Map<string, number>();

export const authenticateToken = async (req: any, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });

  try {
    const payload: any = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] });

    if (!payload?.id) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    if (payload.sid !== SERVER_SESSION_ID) {
      return res.status(401).json({ error: 'Session expired', code: 'SERVER_RESTARTED' });
    }

    const user = await User.findByPk(payload.id);
    if (!user) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    const tokenVersion = typeof payload.v === 'number' ? payload.v : Number(payload.v);
    const userVersion = typeof user.tokenVersion === 'number' ? user.tokenVersion : Number((user as any).tokenVersion);
    if (!Number.isFinite(tokenVersion) || tokenVersion !== userVersion) {
      return res.status(401).json({ error: 'Session expired', code: 'PASSWORD_CHANGED' });
    }

    const dsid = String(payload.dsid || '');
    if (!dsid) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    const device = await DeviceSession.findOne({ where: { id: dsid, userId: user.id } });
    if (!device) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }
    if (device.revokedAt || device.deletedAt) {
      return res.status(401).json({ error: 'Session expired', code: 'DEVICE_REMOVED' });
    }

    const payloadIatSec = typeof payload.iat === 'number' ? payload.iat : Number(payload.iat);
    const payloadIatMs = Number.isFinite(payloadIatSec) ? payloadIatSec * 1000 : 0;
    if (!payloadIatMs || payloadIatMs + 1000 < Number(device.issuedAt)) {
      return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
    }

    const now = Date.now();
    const last = lastSeenUpdate.get(dsid) || 0;
    if (now - last > 60_000) {
      lastSeenUpdate.set(dsid, now);
      void DeviceSession.update({ lastSeenAt: now, updatedAt: now }, { where: { id: dsid } }).catch(() => undefined);
    }

    req.user = { id: user.id, username: user.username, dsid } as AuthUser;
    next();
  } catch {
    return res.status(401).json({ error: 'Session expired', code: 'SESSION_EXPIRED' });
  }
};
