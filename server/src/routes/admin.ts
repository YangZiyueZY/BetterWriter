import express from 'express';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { randomBytes } from 'crypto';
import { exec } from 'child_process';
import { promisify } from 'util';
import bcrypt from 'bcryptjs';
import { Op } from 'sequelize';
import sequelize from '../db';
import User from '../models/User';
import File from '../models/File';
import StorageConfig from '../models/StorageConfig';
import AdminAudit from '../models/AdminAudit';
import { authenticateToken } from '../middleware/authenticateToken';
import { requireAdmin } from '../middleware/requireAdmin';
import { deleteUserFromCloud } from '../services/cloudSync';
import { getLogsDir } from '../services/logger';

const router = express.Router();
const execAsync = promisify(exec);
let lastCpuSample = process.cpuUsage();
let lastCpuSampleAt = Date.now();

router.use(authenticateToken);
router.use(requireAdmin);

const writeAudit = async (actorUserId: number, action: string, targetUserId: number | null, meta?: any) => {
  await AdminAudit.create({
    actorUserId,
    action,
    targetUserId,
    meta: meta === undefined ? null : JSON.stringify(meta),
    createdAt: Date.now(),
  });
};

router.get('/users', async (req: any, res) => {
  try {
    const q = String(req.query.q || '').trim();
    const status = String(req.query.status || '').trim();
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50) || 50));
    const offset = (page - 1) * limit;

    const where: any = {};
    if (q) {
      where.username = { [Op.like]: `%${q}%` };
    }
    if (status === 'active' || status === 'disabled') {
      where.status = status;
    }

    const { rows, count } = await User.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      limit,
      users: rows.map((u: any) => ({
        id: u.id,
        username: u.username,
        status: u.status,
        createdAt: u.createdAt ?? null,
        lastLoginAt: u.lastLoginAt ?? null,
      })),
    });
  } catch (err) {
    console.error('admin list users error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.patch('/users/:id/status', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    const status = String(req.body?.status || '').trim();
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });
    if (status !== 'active' && status !== 'disabled') return res.status(400).json({ error: 'Invalid status' });
    if (id === req.user.id) return res.status(400).json({ error: 'Cannot change current user status' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.status = status as any;
    await user.save();
    await writeAudit(req.user.id, 'user.status.update', user.id, { status });

    res.json({ ok: true });
  } catch (err) {
    console.error('admin update status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/bulk-status', async (req: any, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n)) : [];
    const status = String(req.body?.status || '').trim();
    if (ids.length === 0) return res.status(400).json({ error: 'Empty ids' });
    if (status !== 'active' && status !== 'disabled') return res.status(400).json({ error: 'Invalid status' });

    const filtered = ids.filter((id) => id !== req.user.id);
    await User.update({ status }, { where: { id: filtered } });
    await writeAudit(req.user.id, 'user.status.bulk', null, { ids: filtered, status });
    res.json({ ok: true, updated: filtered.length });
  } catch (err) {
    console.error('admin bulk status error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/:id/reset-password', async (req: any, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });

    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const provided = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const newPassword = provided.trim() || randomBytes(12).toString('base64url').slice(0, 16);
    if (newPassword.length < 6) return res.status(400).json({ error: 'Password too short' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    await user.save();

    await writeAudit(req.user.id, 'user.password.reset', user.id, { by: req.user.username });
    res.json({ ok: true, newPassword });
  } catch (err) {
    console.error('admin reset password error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const deleteLocalUserUploads = async (userId: number) => {
  const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
  const imagesDir = path.join(uploadsDir, 'images', String(userId));
  const avatarsDir = path.join(uploadsDir, 'avatars');

  await fs.promises.rm(imagesDir, { recursive: true, force: true }).catch(() => undefined);
  const avatarFiles = await fs.promises.readdir(avatarsDir).catch(() => []);
  await Promise.all(
    avatarFiles
      .filter((f) => f.startsWith(`${userId}.`))
      .map((f) => fs.promises.rm(path.join(avatarsDir, f), { force: true }).catch(() => undefined))
  );
};

router.delete('/users/:id', async (req: any, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'Invalid user id' });
  if (id === req.user.id) return res.status(400).json({ error: 'Cannot delete current user' });
  try {
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.username === 'admin') return res.status(400).json({ error: 'Cannot delete admin user' });

    const files = await File.findAll({ where: { userId: user.id } });

    await sequelize.transaction(async (t) => {
      await File.destroy({ where: { userId: user.id }, transaction: t });
      await StorageConfig.destroy({ where: { userId: user.id }, transaction: t });
      await User.destroy({ where: { id: user.id }, transaction: t });
    });

    await deleteLocalUserUploads(user.id);
    await deleteUserFromCloud(user.id).catch(() => undefined);

    await writeAudit(req.user.id, 'user.delete', user.id, { username: user.username, files: files.length });
    res.json({ ok: true });
  } catch (err) {
    console.error('admin delete user error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/users/bulk-delete', async (req: any, res) => {
  try {
    const ids: number[] = Array.isArray(req.body?.ids) ? req.body.ids.map((v: any) => Number(v)).filter((n: any) => Number.isFinite(n)) : [];
    if (ids.length === 0) return res.status(400).json({ error: 'Empty ids' });

    const toDelete = ids.filter((id) => id !== req.user.id);
    const users = await User.findAll({ where: { id: toDelete } });
    const safeUsers = users.filter((u: any) => u.username !== 'admin');
    const safeIds = safeUsers.map((u: any) => u.id);

    const fileCounts = await File.count({ where: { userId: safeIds } }).catch(() => 0);

    await sequelize.transaction(async (t) => {
      await File.destroy({ where: { userId: safeIds }, transaction: t });
      await StorageConfig.destroy({ where: { userId: safeIds }, transaction: t });
      await User.destroy({ where: { id: safeIds }, transaction: t });
    });

    await Promise.all(safeIds.map((uid) => deleteLocalUserUploads(uid)));
    await Promise.all(safeIds.map((uid) => deleteUserFromCloud(uid).catch(() => undefined)));

    await writeAudit(req.user.id, 'user.delete.bulk', null, { ids: safeIds });
    res.json({ ok: true, deleted: safeIds.length, files: fileCounts });
  } catch (err) {
    console.error('admin bulk delete error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audits', async (req: any, res) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1) || 1);
    const limit = Math.min(200, Math.max(1, Number(req.query.limit || 50) || 50));
    const offset = (page - 1) * limit;

    const { rows, count } = await AdminAudit.findAndCountAll({
      order: [['createdAt', 'DESC']],
      limit,
      offset,
    });

    res.json({
      total: count,
      page,
      limit,
      audits: rows.map((a: any) => ({
        id: a.id,
        actorUserId: a.actorUserId,
        action: a.action,
        targetUserId: a.targetUserId ?? null,
        meta: a.meta ? (() => { try { return JSON.parse(a.meta); } catch { return a.meta; } })() : null,
        createdAt: a.createdAt,
      })),
    });
  } catch (err) {
    console.error('admin audits error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/metrics', async (_req, res) => {
  const now = Date.now();
  const mem = process.memoryUsage();
  const loadavg = os.loadavg?.() || [];
  const uptime = process.uptime();
  const hostname = os.hostname();
  const cpuCount = os.cpus()?.length || 0;
  const cpuNow = process.cpuUsage();
  const cpuNowAt = Date.now();
  const cpuDeltaMicros = (cpuNow.user - lastCpuSample.user) + (cpuNow.system - lastCpuSample.system);
  const cpuDeltaMs = cpuDeltaMicros / 1000;
  const wallDeltaMs = Math.max(1, cpuNowAt - lastCpuSampleAt);
  const cpuPercent = cpuCount > 0 ? (cpuDeltaMs / (wallDeltaMs * cpuCount)) * 100 : null;
  lastCpuSample = cpuNow;
  lastCpuSampleAt = cpuNowAt;
  const networkInterfaces = os.networkInterfaces();

  let netIO: any = null;
  try {
    const procPath = '/proc/net/dev';
    if (fs.existsSync(procPath)) {
      const raw = await fs.promises.readFile(procPath, 'utf8');
      const lines = raw.split('\n').slice(2);
      let rxBytes = 0;
      let txBytes = 0;
      for (const line of lines) {
        const parts = line.trim().split(/[:\s]+/).filter(Boolean);
        if (parts.length < 17) continue;
        const rx = Number(parts[1]);
        const tx = Number(parts[9]);
        if (Number.isFinite(rx)) rxBytes += rx;
        if (Number.isFinite(tx)) txBytes += tx;
      }
      netIO = { rxBytes, txBytes };
    }
  } catch {
  }

  let processes: any = null;
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execAsync('tasklist /FO CSV /NH', { timeout: 1500, windowsHide: true });
      const lines = stdout.split('\n').map((l) => l.trim()).filter(Boolean);
      const items = lines
        .map((line) => {
          const cols = line
            .split('","')
            .map((c) => c.replace(/^"/, '').replace(/"$/, '').trim());
          if (cols.length < 5) return null;
          const pid = Number(cols[1]);
          return {
            name: cols[0],
            pid: Number.isFinite(pid) ? pid : null,
            sessionName: cols[2],
            session: cols[3],
            mem: cols[4],
          };
        })
        .filter(Boolean)
        .slice(0, 50);
      processes = { platform: 'win32', list: items };
    } else {
      const { stdout } = await execAsync('ps -eo pid,comm,%cpu,%mem --no-headers', { timeout: 1500 });
      const items = stdout
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
        .map((line) => {
          const parts = line.split(/\s+/);
          if (parts.length < 4) return null;
          const pid = Number(parts[0]);
          const cpu = Number(parts[2]);
          const memP = Number(parts[3]);
          return {
            pid: Number.isFinite(pid) ? pid : null,
            name: parts[1],
            cpu: Number.isFinite(cpu) ? cpu : null,
            memPercent: Number.isFinite(memP) ? memP : null,
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => (b.cpu ?? 0) - (a.cpu ?? 0))
        .slice(0, 30);
      processes = { platform: 'posix', list: items };
    }
  } catch {
  }

  let disk: any = null;
  try {
    const statfs = (fs.promises as any).statfs;
    if (typeof statfs === 'function') {
      const basePath = path.join(__dirname, '..', '..');
      const st = await statfs(basePath);
      const totalBytes = Number(st.bsize) * Number(st.blocks);
      const availBytes = Number(st.bsize) * Number(st.bavail);
      const usedBytes = totalBytes - availBytes;
      disk = {
        bsize: Number(st.bsize),
        blocks: Number(st.blocks),
        bfree: Number(st.bfree),
        bavail: Number(st.bavail),
        totalBytes: Number.isFinite(totalBytes) ? totalBytes : null,
        usedBytes: Number.isFinite(usedBytes) ? usedBytes : null,
        availBytes: Number.isFinite(availBytes) ? availBytes : null,
        usedPercent: Number.isFinite(totalBytes) && totalBytes > 0 ? (usedBytes / totalBytes) * 100 : null,
      };
    }
  } catch {
  }

  res.json({
    ts: now,
    hostname,
    pid: process.pid,
    uptime,
    cpuCount,
    loadavg,
    cpu: {
      percent: cpuPercent,
      usage: cpuNow,
    },
    mem: { rss: mem.rss, heapTotal: mem.heapTotal, heapUsed: mem.heapUsed, external: mem.external },
    osMem: { total: os.totalmem(), free: os.freemem() },
    disk,
    network: {
      interfaces: Object.keys(networkInterfaces || {}).map((name) => ({
        name,
        addresses: (networkInterfaces[name] || []).map((a: any) => ({
          address: a.address,
          family: a.family,
          internal: a.internal,
        })),
      })),
      io: netIO,
    },
    processes,
  });
});

router.get('/logs', async (req: any, res) => {
  try {
    const level = String(req.query.level || '').trim();
    const moduleName = String(req.query.module || '').trim();
    const q = String(req.query.q || '').trim();
    const from = Number(req.query.from || 0) || 0;
    const to = Number(req.query.to || Date.now()) || Date.now();
    const limit = Math.min(2000, Math.max(1, Number(req.query.limit || 500) || 500));

    const dir = getLogsDir();
    const files = await fs.promises.readdir(dir).catch(() => []);
    const candidates = files
      .filter((f) => f.startsWith('app-') && f.endsWith('.log'))
      .map((f) => path.join(dir, f));

    const entries: any[] = [];
    for (const f of candidates) {
      const content = await fs.promises.readFile(f, 'utf8').catch(() => '');
      if (!content) continue;
      const lines = content.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        let e: any;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        if (typeof e.ts !== 'number') continue;
        if (e.ts < from || e.ts > to) continue;
        if (level && e.level !== level) continue;
        if (moduleName && e.module !== moduleName) continue;
        if (q) {
          const hay = `${e.msg || ''} ${(e.meta && typeof e.meta === 'string') ? e.meta : ''}`;
          if (!hay.includes(q)) continue;
        }
        entries.push(e);
      }
    }

    entries.sort((a, b) => b.ts - a.ts);
    res.json({ logs: entries.slice(0, limit) });
  } catch (err) {
    console.error('admin logs error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
