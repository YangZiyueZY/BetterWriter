import express from 'express';
import { authenticateToken } from '../middleware/authenticateToken';
import StorageConfig from '../models/StorageConfig';
import { encryptString } from '../lib/crypto';
import { decryptString } from '../lib/crypto';
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from 'webdav';
import File from '../models/File';
import { enqueueFilesSync, enqueueFullSync } from '../services/syncQueue';
import { assertSafeRemoteUrl } from '../lib/ssrf';

const router = express.Router();

const allowPrivateStorageEndpoints =
  process.env.ALLOW_PRIVATE_STORAGE_ENDPOINTS === 'true' || process.env.NODE_ENV !== 'production';

router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const cfg = await StorageConfig.findOne({ where: { userId: req.user.id } });
    if (!cfg) {
      return res.json({ storageType: 'local', s3Config: {}, webDavConfig: {} });
    }

    res.json({
      storageType: cfg.getDataValue('storageType'),
      s3Config: {
        endpoint: cfg.getDataValue('s3Endpoint') || '',
        bucket: cfg.getDataValue('s3Bucket') || '',
        region: cfg.getDataValue('s3Region') || '',
        accessKey: cfg.getDataValue('s3AccessKeyEnc') ? '***' : '',
        secretKey: cfg.getDataValue('s3SecretKeyEnc') ? '***' : '',
      },
      webDavConfig: {
        url: cfg.getDataValue('webdavUrl') || '',
        username: cfg.getDataValue('webdavUsername') || '',
        password: cfg.getDataValue('webdavPasswordEnc') ? '***' : '',
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching storage config' });
  }
});

router.put('/', authenticateToken, async (req: any, res) => {
  try {
    const { storageType, s3Config, webDavConfig } = req.body || {};
    const upsertData: any = { userId: req.user.id };

    if (storageType) {
      upsertData.storageType = storageType;
    }

    if (s3Config) {
      if (typeof s3Config.endpoint === 'string') {
        const endpoint = s3Config.endpoint.trim();
        if (endpoint) {
          upsertData.s3Endpoint = (await assertSafeRemoteUrl(endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString();
        } else {
          upsertData.s3Endpoint = '';
        }
      }
      if (typeof s3Config.bucket === 'string') upsertData.s3Bucket = s3Config.bucket.trim();
      if (typeof s3Config.region === 'string') upsertData.s3Region = s3Config.region.trim();
      if (typeof s3Config.accessKey === 'string' && s3Config.accessKey.trim() && s3Config.accessKey !== '***') {
        upsertData.s3AccessKeyEnc = encryptString(s3Config.accessKey.trim());
      }
      if (typeof s3Config.secretKey === 'string' && s3Config.secretKey.trim() && s3Config.secretKey !== '***') {
        upsertData.s3SecretKeyEnc = encryptString(s3Config.secretKey.trim());
      }
    }

    if (webDavConfig) {
      if (typeof webDavConfig.url === 'string') {
        const url = webDavConfig.url.trim();
        if (url) {
          upsertData.webdavUrl = (await assertSafeRemoteUrl(url, { allowPrivate: allowPrivateStorageEndpoints })).toString();
        } else {
          upsertData.webdavUrl = '';
        }
      }
      if (typeof webDavConfig.username === 'string') upsertData.webdavUsername = webDavConfig.username.trim();
      if (typeof webDavConfig.password === 'string' && webDavConfig.password.trim() && webDavConfig.password !== '***') {
        upsertData.webdavPasswordEnc = encryptString(webDavConfig.password.trim());
      }
    }

    await StorageConfig.upsert(upsertData);
    res.json({ ok: true });

    const current = await StorageConfig.findOne({ where: { userId: req.user.id } });
    const type = current?.getDataValue('storageType');
    if (type === 's3' || type === 'webdav') {
      void enqueueFullSync(req.user.id).catch(() => undefined);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error saving storage config' });
  }
});

router.post('/test', authenticateToken, async (req: any, res) => {
  try {
    const cfg = await StorageConfig.findOne({ where: { userId: req.user.id } });
    if (!cfg) return res.json({ ok: false, message: 'Storage config not set' });

    const storageType = cfg.getDataValue('storageType');
    if (storageType === 'local') return res.json({ ok: true });

    if (storageType === 's3') {
      const s3Endpoint = cfg.getDataValue('s3Endpoint');
      const s3Bucket = cfg.getDataValue('s3Bucket');
      const s3Region = cfg.getDataValue('s3Region') || 'us-east-1';
      const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
      const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
      if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) {
        return res.json({ ok: false, message: 'S3 config incomplete' });
      }

      const safeEndpoint = s3Endpoint
        ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
        : undefined;

      const client = new S3Client({
        region: s3Region,
        endpoint: safeEndpoint,
        credentials: {
          accessKeyId: decryptString(s3AccessKeyEnc),
          secretAccessKey: decryptString(s3SecretKeyEnc),
        },
        forcePathStyle: true,
      });

      await client.send(new ListObjectsV2Command({ Bucket: s3Bucket, MaxKeys: 1 }));
      return res.json({ ok: true });
    }

    if (storageType === 'webdav') {
      const webdavUrl = cfg.getDataValue('webdavUrl');
      const webdavUsername = cfg.getDataValue('webdavUsername');
      const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
      if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) {
        return res.json({ ok: false, message: 'WebDAV config incomplete' });
      }

      const u = await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints });

      const client = createClient(u.toString(), {
        username: webdavUsername,
        password: decryptString(webdavPasswordEnc),
      });
      await client.getDirectoryContents('/');
      return res.json({ ok: true });
    }

    return res.json({ ok: false, message: 'Unsupported storage type' });
  } catch (error: any) {
    console.error('Storage test error:', error);
    return res.json({ ok: false, message: 'Test failed' });
  }
});

router.post('/sync-now', authenticateToken, async (req: any, res) => {
  try {
    const files = await File.findAll({ where: { userId: req.user.id } });
    res.json({ ok: true, queued: files.length });

    enqueueFilesSync(req.user.id, files);
  } catch (error) {
    res.status(500).json({ ok: false, message: 'Sync failed' });
  }
});

router.post('/sync-item', authenticateToken, async (req: any, res) => {
  try {
    const id = String(req.body?.id || '');
    if (!id) return res.status(400).json({ ok: false, message: 'Missing id' });
    const all = await File.findAll({ where: { userId: req.user.id } });
    const map = new Map<string, any>();
    for (const f of all) map.set(String((f as any).getDataValue('id')), f);
    const root = map.get(id);
    if (!root) return res.status(404).json({ ok: false, message: 'Not found' });

    const out: any[] = [];
    const stack: string[] = [id];
    while (stack.length) {
      const cur = stack.pop()!;
      const item = map.get(cur);
      if (!item) continue;
      out.push(item);
      for (const f of all) {
        const pid = (f as any).getDataValue('parentId');
        if (pid && String(pid) === cur) stack.push(String((f as any).getDataValue('id')));
      }
    }

    res.json({ ok: true, queued: out.length });
    enqueueFilesSync(req.user.id, out);
  } catch {
    res.status(500).json({ ok: false, message: 'Sync failed' });
  }
});

export default router;
