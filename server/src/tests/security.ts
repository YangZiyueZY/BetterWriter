process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
process.env.STORAGE_SECRET = process.env.STORAGE_SECRET || 'test-storage-secret';

import assert from 'assert';
import { assertSafeRemoteUrl } from '../lib/ssrf';
import { mirrorDelete, mirrorDeleteRelative, mirrorUpsert } from '../services/localMirror';

const run = async () => {
  await assert.rejects(
    () => assertSafeRemoteUrl('http://127.0.0.1:9000', { allowPrivate: false }),
    /Blocked host|Invalid/
  );

  await assert.rejects(
    () => assertSafeRemoteUrl('http://169.254.169.254/latest/meta-data', { allowPrivate: false }),
    /Blocked host|Invalid/
  );

  await assert.rejects(
    () => assertSafeRemoteUrl('http://192.168.1.10', { allowPrivate: false }),
    /Blocked host|Invalid/
  );

  await assert.rejects(
    () => assertSafeRemoteUrl('http://localhost:3001', { allowPrivate: false }),
    /Blocked host|Invalid/
  );

  const allowedPrivate = await assertSafeRemoteUrl('http://127.0.0.1:9000', { allowPrivate: true });
  assert.strictEqual(allowedPrivate.hostname, '127.0.0.1');

  const u = await assertSafeRemoteUrl('https://1.1.1.1', { allowPrivate: false });
  assert.strictEqual(u.protocol, 'https:');

  await assert.doesNotReject(() => mirrorUpsert(1, { id: '../pwn', name: '../pwn', type: 'file', format: 'md', content: 'x' }));
  await assert.doesNotReject(() => mirrorUpsert(1, { id: 'C:\\pwn', name: 'C:\\pwn', type: 'file', format: 'md', content: 'x' }));
  await assert.doesNotReject(() => mirrorUpsert(1, { id: 'a/b', name: 'a/b', type: 'file', format: 'md', content: 'x' }));

  await assert.rejects(() => mirrorDelete(1, '../pwn'), /Invalid file id|Invalid path/);
  await assert.rejects(() => mirrorDeleteRelative(1, '../pwn.txt'), /Invalid path/);

  console.log('security tests passed');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
