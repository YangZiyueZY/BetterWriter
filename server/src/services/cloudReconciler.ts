import { S3Client, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from 'webdav';
import File from '../models/File';
import StorageConfig from '../models/StorageConfig';
import { decryptString } from '../lib/crypto';
import { assertSafeRemoteUrl } from '../lib/ssrf';
import { resolveRelativePath, toNotesRemoteKey } from './syncPaths';
import { syncUpsertToCloud } from './cloudSync';
import { writeSyncLog } from './syncLog';

const allowPrivateStorageEndpoints =
  process.env.ALLOW_PRIVATE_STORAGE_ENDPOINTS === 'true' || process.env.NODE_ENV !== 'production';

const getS3Client = async (cfg: any) => {
  const safeEndpoint = cfg.s3Endpoint
    ? (await assertSafeRemoteUrl(cfg.s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
    : undefined;
  return new S3Client({
    region: cfg.s3Region || 'us-east-1',
    endpoint: safeEndpoint,
    credentials: {
      accessKeyId: decryptString(cfg.s3AccessKeyEnc),
      secretAccessKey: decryptString(cfg.s3SecretKeyEnc),
    },
    forcePathStyle: true,
  });
};

const listS3Keys = async (client: S3Client, bucket: string, prefix: string) => {
  let token: string | undefined;
  const keys: string[] = [];
  for (;;) {
    const resp: any = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: token,
      })
    );
    const contents = Array.isArray(resp?.Contents) ? resp.Contents : [];
    for (const obj of contents) {
      if (obj?.Key) keys.push(String(obj.Key));
    }
    if (resp?.IsTruncated && resp?.NextContinuationToken) {
      token = String(resp.NextContinuationToken);
      continue;
    }
    break;
  }
  return keys;
};

const buildExpectedKeys = async (userId: number, files: any[]) => {
  const expected = new Set<string>();
  for (const f of files) {
    const rel = await resolveRelativePath(userId, f);
    const key = toNotesRemoteKey(userId, rel);
    if (String((f as any).getDataValue('type')) === 'folder') expected.add(`${key}/.keep`);
    else expected.add(key);
  }
  return expected;
};

export const reconcileUserCloud = async (userId: number) => {
  const cfg: any = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = String(cfg.getDataValue('storageType') || 'local');
  if (storageType !== 's3' && storageType !== 'webdav') return;

  const files = await File.findAll({ where: { userId } });
  const expected = await buildExpectedKeys(userId, files);

  for (const f of files) {
    try {
      await syncUpsertToCloud(userId, f);
    } catch {
    }
  }

  if (storageType === 's3') {
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;
    const client = await getS3Client({
      s3Endpoint: cfg.getDataValue('s3Endpoint'),
      s3Bucket,
      s3Region: cfg.getDataValue('s3Region'),
      s3AccessKeyEnc,
      s3SecretKeyEnc,
    });
    const prefix = `${userId}/notes/`;
    const keys = await listS3Keys(client, s3Bucket, prefix);
    const toDelete = keys.filter((k) => !expected.has(k));
    await Promise.all(
      toDelete.map((k) =>
        client
          .send(new DeleteObjectCommand({ Bucket: s3Bucket, Key: k }))
          .then(() => writeSyncLog({ ts: Date.now(), userId, action: 'prune', remoteKey: k, ok: true }).catch(() => undefined))
          .catch((e: any) => writeSyncLog({ ts: Date.now(), userId, action: 'prune', remoteKey: k, ok: false, error: e?.message || String(e) }).catch(() => undefined))
      )
    );
    return;
  }

  const webdavUrl = cfg.getDataValue('webdavUrl');
  const webdavUsername = cfg.getDataValue('webdavUsername');
  const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
  if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;
  const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
  const client: any = createClient(safeUrl, {
    username: webdavUsername,
    password: decryptString(webdavPasswordEnc),
  });
  const root = `/${userId}/notes`;
  try {
    await client.createDirectory(root);
  } catch {
  }
  const items: any[] = await client.getDirectoryContents(root, { deep: true }).catch(() => []);
  const paths: string[] = Array.isArray(items) ? items.map((i: any) => i?.filename).filter(Boolean) : [];
  const expectedPaths = new Set(Array.from(expected).map((k) => `/${k}`));
  const deletions = paths.filter((p) => !expectedPaths.has(String(p)));
  deletions.sort((a, b) => String(b).length - String(a).length);
  await Promise.all(
    deletions.map((p) =>
      client
        .deleteFile(p)
        .then(() => writeSyncLog({ ts: Date.now(), userId, action: 'prune', remoteKey: p, ok: true }).catch(() => undefined))
        .catch((e: any) => writeSyncLog({ ts: Date.now(), userId, action: 'prune', remoteKey: p, ok: false, error: e?.message || String(e) }).catch(() => undefined))
    )
  );
};
