process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.STORAGE_SECRET = process.env.STORAGE_SECRET || 'test-storage-secret';
process.env.SQLITE_STORAGE_PATH = process.env.SQLITE_STORAGE_PATH || ':memory:';

import assert from 'assert';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const run = async () => {
  const { default: sequelize } = await import('../db');
  const { default: User } = await import('../models/User');
  const { default: DeviceSession } = await import('../models/DeviceSession');

  await sequelize.sync({ force: true });

  const user = await User.create({
    username: 'u',
    password: await bcrypt.hash('pw', 10),
    tokenVersion: 0,
    status: 'active',
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

  const deleteFn = async () => {
    await sleep(10);
    const d: any = await DeviceSession.findByPk(dsid);
    const t = Date.now();
    d.revokedAt = t;
    d.deletedAt = t;
    d.undoUntil = t + 5 * 60 * 1000;
    d.updatedAt = t;
    await d.save();
  };

  const undoFn = async () => {
    await sleep(15);
    const d: any = await DeviceSession.findByPk(dsid);
    const t = Date.now();
    if (d.undoUntil && d.undoUntil > t) {
      d.revokedAt = null;
      d.deletedAt = null;
      d.undoUntil = null;
      d.updatedAt = t;
      await d.save();
    }
  };

  await Promise.all([deleteFn(), undoFn()]);
  const final: any = await DeviceSession.findByPk(dsid);
  const restored = final.revokedAt === null && final.deletedAt === null && final.undoUntil === null;
  const deleted = final.revokedAt !== null && final.deletedAt !== null && final.undoUntil !== null;
  assert.strictEqual(restored || deleted, true);
  if (restored) {
    assert.strictEqual(final.anomalous === 0 || final.anomalous === 1, true);
  }

  console.log('device concurrency tests passed');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

