process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.STORAGE_SECRET = process.env.STORAGE_SECRET || 'test-storage-secret';

import assert from 'assert';
import { requireAdmin } from '../middleware/requireAdmin';

const run = async () => {
  let status: number | null = null;
  let body: any = null;
  const res: any = {
    status: (s: number) => {
      status = s;
      return {
        json: (b: any) => {
          body = b;
        },
      };
    },
  };

  let called = false;
  requireAdmin({ user: { username: 'u' } }, res, () => {
    called = true;
  });
  assert.strictEqual(called, false);
  assert.strictEqual(status, 403);
  assert.strictEqual(body?.code, 'FORBIDDEN');

  status = null;
  body = null;
  called = false;
  requireAdmin({ user: { username: 'admin' } }, res, () => {
    called = true;
  });
  assert.strictEqual(called, true);

  console.log('admin security tests passed');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
