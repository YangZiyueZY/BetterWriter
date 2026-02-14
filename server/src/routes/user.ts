import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import User from '../models/User';
import DeviceSession from '../models/DeviceSession';
import SecurityAlert from '../models/SecurityAlert';
import DeviceAudit from '../models/DeviceAudit';
import { authenticateToken } from '../middleware/authenticateToken';
import { syncAvatarToCloud } from '../services/cloudSync';
import { ENABLE_MOBILE } from '../config';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import { randomUUID } from 'crypto';
import geoip from 'geoip-lite';

const router = express.Router();

const getClientIp = (req: any): string => {
  const ip = req.ip || (req.connection as any)?.remoteAddress || '';
  return String(ip || '').replace('::ffff:', '');
};

const geoFromIp = (ipRaw: string): string | null => {
  const ip = String(ipRaw || '').replace('::ffff:', '');
  if (!ip) return null;
  const hit: any = geoip.lookup(ip);
  if (!hit) return null;
  const parts = [hit.country, hit.region, hit.city].filter(Boolean);
  return parts.length ? parts.join(' ') : null;
};

const writeDeviceAudit = async (userId: number, action: string, targetDeviceSessionId: string | null, ip: string | null, meta?: any) => {
  await DeviceAudit.create({
    userId,
    action,
    targetDeviceSessionId,
    ip: ip || null,
    meta: meta === undefined ? null : JSON.stringify(meta),
    createdAt: Date.now(),
  });
};

// 配置 multer 存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req: any, file, cb) => {
    const userId = req.user.id;
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${userId}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname && mimetype) {
      return cb(null, true);
    }
    cb(new Error('Only image files are allowed!'));
  },
});

// Upload Avatar
router.post('/avatar', authenticateToken, upload.single('avatar'), async (req: any, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // 构建相对 URL
    const filename = req.file.filename;
    const avatarUrl = `/uploads/avatars/${filename}`;

    // 更新用户头像字段
    user.avatar = avatarUrl;
    await user.save();

    // 触发云同步
    try {
        const fileContent = fs.readFileSync(req.file.path);
        const ext = path.extname(filename).substring(1); // 去掉点
        await syncAvatarToCloud(userId, fileContent, ext);
    } catch (syncError) {
        console.error('Avatar cloud sync failed:', syncError);
        // 不阻断主流程
    }

    res.json({ message: 'Avatar uploaded successfully', avatar: avatarUrl });
  } catch (error) {
    console.error('Upload avatar error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update Profile (Avatar URL)
router.put('/profile', authenticateToken, async (req: any, res) => {
  try {
    const { avatar } = req.body;
    const user = await User.findByPk(req.user.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (avatar !== undefined) {
      user.avatar = avatar;
    }

    await user.save();
    res.json({ message: 'Profile updated successfully', user: { id: user.id, username: user.username, avatar: user.avatar } });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get Profile
router.get('/profile', authenticateToken, async (req: any, res) => {
    try {
      const user = await User.findByPk(req.user.id);
      if (!user) return res.status(404).json({ error: 'User not found' });
  
      const payload: any = { id: user.id, username: user.username, avatar: user.avatar };
      if (ENABLE_MOBILE) {
        payload.mobileKey = user.mobileKey;
      }
      res.json({ user: payload });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

router.get('/devices', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const q = String(req.query.q || '').trim();
    const deviceType = String(req.query.deviceType || '').trim();
    const ip = String(req.query.ip || '').trim();
    const from = Number(req.query.from || 0) || 0;
    const to = Number(req.query.to || 0) || 0;
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit || 10) || 10));
    const offset = (page - 1) * limit;

    const where: any = { userId };
    if (deviceType && deviceType !== 'all') where.deviceType = deviceType;
    if (ip) where.lastLoginIp = { [Op.like]: `%${ip}%` };
    if (from || to) {
      where.lastLoginAt = {};
      if (from) where.lastLoginAt[Op.gte] = from;
      if (to) where.lastLoginAt[Op.lte] = to;
    }
    if (q) {
      where[Op.or] = [
        { deviceName: { [Op.like]: `%${q}%` } },
        { deviceModel: { [Op.like]: `%${q}%` } },
        { osInfo: { [Op.like]: `%${q}%` } },
        { lastLoginLocation: { [Op.like]: `%${q}%` } },
      ];
    }

    const { rows, count } = await DeviceSession.findAndCountAll({
      where,
      order: [['lastLoginAt', 'DESC']],
      limit,
      offset,
    });

    const currentDsid = String(req.user.dsid || '');
    res.json({
      total: count,
      page,
      limit,
      devices: rows.map((d: any) => ({
        id: d.id,
        deviceName: d.deviceName,
        deviceModel: d.deviceModel,
        deviceType: d.deviceType,
        osInfo: d.osInfo,
        lastLoginAt: d.lastLoginAt,
        lastLoginIp: d.lastLoginIp,
        lastLoginLocation: d.lastLoginLocation,
        lastSeenAt: d.lastSeenAt,
        revokedAt: d.revokedAt,
        deletedAt: d.deletedAt,
        undoUntil: d.undoUntil,
        anomalous: Boolean(d.anomalous),
        anomalyReason: d.anomalyReason,
        isCurrent: currentDsid && d.id === currentDsid,
      })),
    });
  } catch (error) {
    console.error('List devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/devices/:id', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const deviceId = String(req.params.id || '').trim();
    const password = String(req.body?.password || '');
    if (!deviceId) return res.status(400).json({ error: 'Invalid device id' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' });

    const device = await DeviceSession.findOne({ where: { id: deviceId, userId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const now = Date.now();
    device.revokedAt = now;
    device.deletedAt = now;
    device.undoUntil = now + 5 * 60 * 1000;
    device.updatedAt = now;
    await device.save();

    const ip = getClientIp(req);
    await writeDeviceAudit(userId, 'device.delete', device.id, ip, { undoUntil: device.undoUntil });
    res.json({ ok: true, id: device.id, undoUntil: device.undoUntil, self: String(req.user.dsid || '') === device.id });
  } catch (error) {
    console.error('Delete device error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/devices/bulk-delete', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids.map((v: any) => String(v)).filter(Boolean) : [];
    const password = String(req.body?.password || '');
    if (ids.length === 0) return res.status(400).json({ error: 'Empty ids' });
    if (!password) return res.status(400).json({ error: 'Password is required' });

    const user = await User.findByPk(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(401).json({ error: 'Invalid password', code: 'INVALID_PASSWORD' });

    const now = Date.now();
    const undoUntil = now + 5 * 60 * 1000;

    const devices = await DeviceSession.findAll({ where: { userId, id: ids } });
    const foundIds = devices.map((d: any) => d.id);
    await Promise.all(
      devices.map((d: any) => {
        d.revokedAt = now;
        d.deletedAt = now;
        d.undoUntil = undoUntil;
        d.updatedAt = now;
        return d.save();
      })
    );

    const ip = getClientIp(req);
    await writeDeviceAudit(userId, 'device.delete.bulk', null, ip, { ids: foundIds, undoUntil });
    const currentDsid = String(req.user.dsid || '');
    res.json({ ok: true, deleted: foundIds, undoUntil, selfDeleted: foundIds.includes(currentDsid) });
  } catch (error) {
    console.error('Bulk delete devices error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/devices/:id/undo', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const deviceId = String(req.params.id || '').trim();
    if (!deviceId) return res.status(400).json({ error: 'Invalid device id' });

    const device = await DeviceSession.findOne({ where: { id: deviceId, userId } });
    if (!device) return res.status(404).json({ error: 'Device not found' });

    const now = Date.now();
    if (!device.undoUntil || device.undoUntil < now) {
      return res.status(400).json({ error: 'Undo expired', code: 'UNDO_EXPIRED' });
    }

    device.revokedAt = null;
    device.deletedAt = null;
    device.undoUntil = null;
    device.updatedAt = now;
    await device.save();

    const ip = getClientIp(req);
    await writeDeviceAudit(userId, 'device.undo', device.id, ip);
    res.json({ ok: true, id: device.id });
  } catch (error) {
    console.error('Undo device delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/security-alerts', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const onlyUnread = String(req.query.onlyUnread || 'true') !== 'false';
    const where: any = { userId };
    if (onlyUnread) where.readAt = null;
    const alerts = await SecurityAlert.findAll({ where, order: [['createdAt', 'DESC']], limit: 100 });
    res.json({
      alerts: alerts.map((a: any) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        message: a.message,
        meta: a.meta ? (() => { try { return JSON.parse(a.meta); } catch { return a.meta; } })() : null,
        createdAt: a.createdAt,
        readAt: a.readAt,
      })),
    });
  } catch (error) {
    console.error('List security alerts error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/security-alerts/:id/read', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const id = String(req.params.id || '').trim();
    if (!id) return res.status(400).json({ error: 'Invalid alert id' });
    const a = await SecurityAlert.findOne({ where: { id, userId } });
    if (!a) return res.status(404).json({ error: 'Alert not found' });
    a.readAt = Date.now();
    await a.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Read security alert error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
