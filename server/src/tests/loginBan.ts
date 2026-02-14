import assert from 'assert';
import { clearLoginFailures, getIpBanStatus, recordLoginFailure } from '../lib/loginBan';

const run = async () => {
  const ip = '1.2.3.4';
  clearLoginFailures(ip);
  const cfg = { maxFailedAttempts: 3, windowMs: 10_000, banMs: 60_000 };

  let r = recordLoginFailure(ip, cfg, 1000);
  assert.strictEqual(r.banned, false);
  r = recordLoginFailure(ip, cfg, 2000);
  assert.strictEqual(r.banned, false);
  r = recordLoginFailure(ip, cfg, 3000);
  assert.strictEqual(r.banned, true);

  const s1 = getIpBanStatus(ip, 4000);
  assert.strictEqual(s1.banned, true);
  assert.ok(s1.remainingMs > 0);

  const s2 = getIpBanStatus(ip, 3000 + 60_000 + 1);
  assert.strictEqual(s2.banned, false);

  clearLoginFailures(ip);
  recordLoginFailure(ip, cfg, 1000);
  recordLoginFailure(ip, cfg, 1000 + cfg.windowMs + 1);
  const s3 = getIpBanStatus(ip, 1000 + cfg.windowMs + 2);
  assert.strictEqual(s3.banned, false);

  console.log('login ban tests passed');
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

