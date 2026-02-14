process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.STORAGE_SECRET = process.env.STORAGE_SECRET || 'test-storage-secret';
process.env.SQLITE_STORAGE_PATH = process.env.SQLITE_STORAGE_PATH || ':memory:';

import assert from 'assert';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const run = async () => {
  const { default: sequelize } = await import('../db');
  const { default: User } = await import('../models/User');
  const { default: DeviceSession } = await import('../models/DeviceSession');
  const { authenticateToken } = await import('../middleware/authenticateToken');
  const { JWT_SECRET, SERVER_SESSION_ID } = await import('../config');

  await sequelize.sync({ force: true });

  const user = await User.create({
    username: 'u',
    password: await bcrypt.hash('pw', 10),
    tokenVersion: 0,
    status: 'active',
    lastLoginAt: null,
  } as any);

  const now = Date.now();
  const dsid = randomUUID();
  await DeviceSession.create({
    id: dsid,
    userId: user.id,
    deviceKey: 'k',
    deviceName: 'd',
    deviceModel: null,
    deviceType: 'desktop',
    osInfo: 'os',
    lastLoginAt: now,
    lastLoginIp: '1.1.1.1',
    lastLoginLocation: 'X',
    issuedAt: now,
    lastSeenAt: now,
    revokedAt: null,
    deletedAt: null,
    undoUntil: null,
    anomalous: 0,
    anomalyReason: null,
    createdAt: now,
    updatedAt: now,
  } as any);

  const token = jwt.sign({ id: user.id, username: user.username, sid: SERVER_SESSION_ID, v: 0, dsid }, JWT_SECRET, { expiresIn: '7d' });

  const mkRes = () => {
    const res: any = {};
    res.statusCode = 200;
    res.body = null;
    res.status = (s: number) => {
      res.statusCode = s;
      return res;
    };
    res.json = (b: any) => {
      res.body = b;
      return res;
    };
    res.setHeader = () => undefined;
    return res;
  };

  const req: any = { headers: { authorization: `Bearer ${token}` }, connection: { remoteAddress: '1.1.1.1' } };
  const res1 = mkRes();
  let called = false;
  await authenticateToken(req, res1, () => {
    called = true;
  });
  assert.strictEqual(called, true);
  assert.strictEqual(req.user?.dsid, dsid);

  await DeviceSession.update({ revokedAt: Date.now() }, { where: { id: dsid } });
  const req2: any = { headers: { authorization: `Bearer ${token}` }, connection: { remoteAddress: '1.1.1.1' } };
  const res2 = mkRes();
  called = false;
  await authenticateToken(req2, res2, () => {
    called = true;
  });
  assert.strictEqual(called, false);
  assert.strictEqual(res2.statusCode, 401);
  assert.strictEqual(res2.body?.code, 'DEVICE_REMOVED');

  await DeviceSession.update({ revokedAt: null, deletedAt: null, issuedAt: Date.now() + 60_000 }, { where: { id: dsid } });
  const req3: any = { headers: { authorization: `Bearer ${token}` }, connection: { remoteAddress: '1.1.1.1' } };
  const res3 = mkRes();
  called = false;
  await authenticateToken(req3, res3, () => {
    called = true;
  });
  assert.strictEqual(called, false);
  assert.strictEqual(res3.statusCode, 401);
  assert.strictEqual(res3.body?.code, 'SESSION_EXPIRED');

  console.log('device auth tests passed');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

