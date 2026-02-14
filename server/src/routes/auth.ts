import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import User from '../models/User';
import { ENABLE_MOBILE, JWT_SECRET, SERVER_SESSION_ID, LOGIN_BAN_MS, LOGIN_FAIL_WINDOW_MS, LOGIN_MAX_FAILED_ATTEMPTS, MAX_ACTIVE_DEVICES_PER_ACCOUNT } from '../config';
import { authenticateToken } from '../middleware/authenticateToken';
import { clearLoginFailures, getIpBanStatus, recordLoginFailure } from '../lib/loginBan';
import DeviceSession from '../models/DeviceSession';
import SecurityAlert from '../models/SecurityAlert';
import geoip from 'geoip-lite';

const router = express.Router();

if (ENABLE_MOBILE) {
  router.get('/mobile-key', authenticateToken, async (req: any, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      if (!user.mobileKey) {
        user.mobileKey = randomUUID();
        await user.save();
      }

      res.json({ mobileKey: user.mobileKey });
    } catch (error) {
      console.error('Get mobile key error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  router.post('/mobile-key/regenerate', authenticateToken, async (req: any, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });

      user.mobileKey = randomUUID();
      await user.save();

      res.json({ mobileKey: user.mobileKey });
    } catch (error) {
      console.error('Regenerate mobile key error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const existingUser = await User.findOne({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ username, password: hashedPassword });

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const ip = req.ip || (req.connection as any)?.remoteAddress || 'unknown';
    const ban = getIpBanStatus(ip);
    if (ban.banned) {
      const retryAfterSec = Math.max(1, Math.ceil(ban.remainingMs / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({ error: 'Too many failed attempts', code: 'IP_BANNED', retryAfterSec });
    }

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      const r = recordLoginFailure(ip, { maxFailedAttempts: LOGIN_MAX_FAILED_ATTEMPTS, windowMs: LOGIN_FAIL_WINDOW_MS, banMs: LOGIN_BAN_MS });
      if (r.banned) {
        const retryAfterSec = Math.max(1, Math.ceil(r.remainingMs / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: 'Too many failed attempts', code: 'IP_BANNED', retryAfterSec });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    if ((user as any).status === 'disabled') {
      return res.status(403).json({ error: 'Account disabled', code: 'ACCOUNT_DISABLED' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      const r = recordLoginFailure(ip, { maxFailedAttempts: LOGIN_MAX_FAILED_ATTEMPTS, windowMs: LOGIN_FAIL_WINDOW_MS, banMs: LOGIN_BAN_MS });
      if (r.banned) {
        const retryAfterSec = Math.max(1, Math.ceil(r.remainingMs / 1000));
        res.setHeader('Retry-After', String(retryAfterSec));
        return res.status(429).json({ error: 'Too many failed attempts', code: 'IP_BANNED', retryAfterSec });
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const deviceKey = String(req.body?.deviceKey || '').trim();
    const deviceType = String(req.body?.deviceType || 'unknown').trim() || 'unknown';
    const deviceName = String(req.body?.deviceName || '').trim() || '未知设备';
    const deviceModel = String(req.body?.deviceModel || '').trim() || null;
    const osInfo = String(req.body?.osInfo || '').trim() || null;
    if (!deviceKey) {
      return res.status(400).json({ error: 'Device info missing', code: 'DEVICE_INFO_MISSING' });
    }

    const ipText = String(ip || '').replace('::ffff:', '');
    const geo: any = geoip.lookup(ipText);
    const location = geo ? [geo.country, geo.region, geo.city].filter(Boolean).join(' ') || null : null;

    const existing = await DeviceSession.findOne({ where: { userId: user.id, deviceKey } });
    const activeCount = await DeviceSession.count({ where: { userId: user.id, revokedAt: null, deletedAt: null } });
    const willActivate = !existing || existing.revokedAt || existing.deletedAt;
    if (willActivate && activeCount >= MAX_ACTIVE_DEVICES_PER_ACCOUNT) {
      return res.status(403).json({ error: 'Too many devices', code: 'DEVICE_LIMIT', limit: MAX_ACTIVE_DEVICES_PER_ACCOUNT, active: activeCount });
    }

    const now = Date.now();
    let session: any = existing;
    let anomalyReason: string | null = null;
    if (!session) {
      session = await DeviceSession.create({
        id: randomUUID(),
        userId: user.id,
        deviceKey,
        deviceName,
        deviceModel,
        deviceType,
        osInfo,
        lastLoginAt: now,
        lastLoginIp: ipText || null,
        lastLoginLocation: location,
        issuedAt: now,
        lastSeenAt: now,
        revokedAt: null,
        deletedAt: null,
        undoUntil: null,
        anomalous: 1,
        anomalyReason: '新设备登录',
        createdAt: now,
        updatedAt: now,
      });
      anomalyReason = '新设备登录';
    } else {
      const prevLoc = session.lastLoginLocation ? String(session.lastLoginLocation) : null;
      const isNewLocation = Boolean(location && prevLoc && location !== prevLoc);
      const isRevived = Boolean(session.deletedAt || session.revokedAt);
      if (isRevived) {
        anomalyReason = '新设备登录';
      } else if (isNewLocation) {
        anomalyReason = '异地登录';
      }
      session.deviceName = deviceName;
      session.deviceModel = deviceModel;
      session.deviceType = deviceType;
      session.osInfo = osInfo;
      session.lastLoginAt = now;
      session.lastLoginIp = ipText || null;
      session.lastLoginLocation = location;
      session.issuedAt = now;
      session.lastSeenAt = now;
      session.revokedAt = null;
      session.deletedAt = null;
      session.undoUntil = null;
      session.anomalous = anomalyReason ? 1 : 0;
      session.anomalyReason = anomalyReason;
      session.updatedAt = now;
      await session.save();
    }

    if (anomalyReason) {
      const title = anomalyReason === '异地登录' ? '安全提醒：检测到异地登录' : '安全提醒：检测到新设备登录';
      const msgParts = [
        `账号：${user.username}`,
        `设备：${deviceName}`,
        ipText ? `IP：${ipText}` : null,
        location ? `地点：${location}` : null,
        `时间：${new Date(now).toISOString()}`,
      ].filter(Boolean);
      await SecurityAlert.create({
        id: randomUUID(),
        userId: user.id,
        type: anomalyReason === '异地登录' ? 'NEW_LOCATION' : 'NEW_DEVICE',
        title,
        message: msgParts.join('；'),
        meta: JSON.stringify({ dsid: session.id, deviceType, osInfo }),
        createdAt: now,
        readAt: null,
      }).catch(() => undefined);
    }

    clearLoginFailures(ip);
    user.lastLoginAt = Date.now();
    await user.save();

    const token = jwt.sign({ id: user.id, username: user.username, sid: SERVER_SESSION_ID, v: user.tokenVersion, dsid: session.id }, JWT_SECRET, {
      expiresIn: '7d',
    });

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Change Password
router.post('/change-password', async (req, res) => {
  try {
    const { username, oldPassword, newPassword } = req.body;

    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Username, old password, and new password are required' });
    }

    const user = await User.findOne({ where: { username } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid old password' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    res.json({ message: 'Password updated successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
