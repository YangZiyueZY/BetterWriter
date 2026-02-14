type LoginBanConfig = {
  maxFailedAttempts: number;
  windowMs: number;
  banMs: number;
};

type BanState = {
  count: number;
  firstAt: number;
  lastAt: number;
  banUntil: number;
};

const store = new Map<string, BanState>();

const ensureState = (ip: string, now: number, cfg: LoginBanConfig): BanState => {
  const prev = store.get(ip);
  if (!prev) {
    const s: BanState = { count: 0, firstAt: now, lastAt: now, banUntil: 0 };
    store.set(ip, s);
    return s;
  }
  if (prev.banUntil > 0 && prev.banUntil <= now) {
    store.delete(ip);
    const s: BanState = { count: 0, firstAt: now, lastAt: now, banUntil: 0 };
    store.set(ip, s);
    return s;
  }
  if (now - prev.firstAt > cfg.windowMs) {
    prev.count = 0;
    prev.firstAt = now;
  }
  prev.lastAt = now;
  return prev;
};

export const getIpBanStatus = (ip: string, now: number = Date.now()) => {
  const s = store.get(ip);
  if (!s) return { banned: false as const, remainingMs: 0 };
  if (s.banUntil > now) return { banned: true as const, remainingMs: s.banUntil - now };
  if (s.banUntil > 0 && s.banUntil <= now) {
    store.delete(ip);
    return { banned: false as const, remainingMs: 0 };
  }
  return { banned: false as const, remainingMs: 0 };
};

export const recordLoginFailure = (ip: string, cfg: LoginBanConfig, now: number = Date.now()) => {
  const s = ensureState(ip, now, cfg);
  if (s.banUntil > now) return { banned: true as const, remainingMs: s.banUntil - now, count: s.count };

  s.count += 1;
  s.lastAt = now;
  if (s.count >= cfg.maxFailedAttempts) {
    s.banUntil = now + cfg.banMs;
    return { banned: true as const, remainingMs: cfg.banMs, count: s.count };
  }
  return { banned: false as const, remainingMs: 0, count: s.count };
};

export const clearLoginFailures = (ip: string) => {
  store.delete(ip);
};

export const cleanupLoginBanStore = (now: number = Date.now(), maxAgeMs: number = 24 * 60 * 60 * 1000) => {
  for (const [ip, s] of store.entries()) {
    if (now - s.lastAt > maxAgeMs) {
      store.delete(ip);
    }
  }
};

