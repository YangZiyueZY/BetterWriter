import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { createClient } from 'webdav';
import StorageConfig from '../models/StorageConfig';
import { decryptString } from '../lib/crypto';
import { assertSafeRemoteUrl } from '../lib/ssrf';
import { resolveRelativePath, toNotesRemoteKey } from './syncPaths';
import { sha256, writeSyncLog } from './syncLog';

const allowPrivateStorageEndpoints =
  process.env.ALLOW_PRIVATE_STORAGE_ENDPOINTS === 'true' || process.env.NODE_ENV !== 'production';

const getS3Client = (cfg: any) => {
  return new S3Client({
    region: cfg.s3Region || 'us-east-1',
    endpoint: cfg.s3Endpoint || undefined,
    credentials: {
      accessKeyId: decryptString(cfg.s3AccessKeyEnc),
      secretAccessKey: decryptString(cfg.s3SecretKeyEnc),
    },
    forcePathStyle: true,
  });
};

export const syncUpsertToCloud = async (userId: number, file: any): Promise<void> => {
  const cfg = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = cfg.getDataValue('storageType');
  if (storageType === 'local') return;

  const rel = await resolveRelativePath(userId, file);
  const key = toNotesRemoteKey(userId, rel);
  const isFolder = file.type === 'folder';
  const content = typeof file.content === 'string' ? file.content : '';
  const keepKey = `${key}/.keep`;
  const hash = isFolder ? undefined : sha256(content);

  if (storageType === 's3') {
    const s3Endpoint = cfg.getDataValue('s3Endpoint');
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3Region = cfg.getDataValue('s3Region');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;

    const safeEndpoint = s3Endpoint
      ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
      : undefined;
    const client = getS3Client({ s3Endpoint: safeEndpoint, s3Bucket, s3Region, s3AccessKeyEnc, s3SecretKeyEnc });
    try {
      if (isFolder) {
        await client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: keepKey,
            Body: '',
            ContentType: 'text/plain; charset=utf-8',
          })
        );
        await writeSyncLog({ ts: Date.now(), userId, action: 'upsert_folder', relPath: rel, remoteKey: keepKey, ok: true });
        return;
      }
      await client.send(
        new PutObjectCommand({
          Bucket: s3Bucket,
          Key: key,
          Body: content,
          ContentType: 'text/plain; charset=utf-8',
        })
      );
      await writeSyncLog({ ts: Date.now(), userId, action: 'upsert_file', relPath: rel, remoteKey: key, ok: true, hash });
    } catch (e: any) {
      await writeSyncLog({ ts: Date.now(), userId, action: isFolder ? 'upsert_folder' : 'upsert_file', relPath: rel, remoteKey: isFolder ? keepKey : key, ok: false, hash, error: e?.message || String(e) }).catch(() => undefined);
      throw e;
    }
    return;
  }

  if (storageType === 'webdav') {
    const webdavUrl = cfg.getDataValue('webdavUrl');
    const webdavUsername = cfg.getDataValue('webdavUsername');
    const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
    if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;

    const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
    const client = createClient(safeUrl, {
      username: webdavUsername,
      password: decryptString(webdavPasswordEnc),
    });
    const userDir = `/${userId}/notes`;
    const remotePath = `/${key}`;
    const remoteDir = remotePath.split('/').slice(0, -1).join('/') || userDir;
    try {
      await client.createDirectory(userDir);
    } catch {
    }
    try {
      await client.createDirectory(remoteDir);
    } catch {
    }
    try {
      if (isFolder) {
        try {
          await client.createDirectory(remotePath);
        } catch {
        }
        await client.putFileContents(`${remotePath}/.keep`, '', { overwrite: true });
        await writeSyncLog({ ts: Date.now(), userId, action: 'upsert_folder', relPath: rel, remoteKey: `${remotePath}/.keep`, ok: true });
        return;
      }
      await client.putFileContents(remotePath, content, { overwrite: true });
      await writeSyncLog({ ts: Date.now(), userId, action: 'upsert_file', relPath: rel, remoteKey: remotePath, ok: true, hash });
    } catch (e: any) {
      await writeSyncLog({ ts: Date.now(), userId, action: isFolder ? 'upsert_folder' : 'upsert_file', relPath: rel, remoteKey: isFolder ? `${remotePath}/.keep` : remotePath, ok: false, hash, error: e?.message || String(e) }).catch(() => undefined);
      throw e;
    }
  }
};

export const syncDeleteFromCloud = async (userId: number, fileId: string): Promise<void> => {
  const cfg = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = cfg.getDataValue('storageType');
  if (storageType === 'local') return;

  if (storageType === 's3') {
    const s3Endpoint = cfg.getDataValue('s3Endpoint');
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3Region = cfg.getDataValue('s3Region');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;

    const safeEndpoint = s3Endpoint
      ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
      : undefined;
    const client = getS3Client({ s3Endpoint: safeEndpoint, s3Bucket, s3Region, s3AccessKeyEnc, s3SecretKeyEnc });
    await Promise.all(
      ['md', 'txt'].map((ext) =>
        client.send(
          new DeleteObjectCommand({
            Bucket: s3Bucket,
            Key: `${userId}/${fileId}.${ext}`,
          })
        ).catch(() => undefined)
      )
    );
    return;
  }

  if (storageType === 'webdav') {
    const webdavUrl = cfg.getDataValue('webdavUrl');
    const webdavUsername = cfg.getDataValue('webdavUsername');
    const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
    if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;

    const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
    const client = createClient(safeUrl, {
      username: webdavUsername,
      password: decryptString(webdavPasswordEnc),
    });
    const userDir = `/${userId}`;
    await Promise.all(
      ['md', 'txt'].map((ext) =>
        client.deleteFile(`${userDir}/${fileId}.${ext}`).catch(() => undefined)
      )
    );
  }
};

export const syncDeleteRelativeFromCloud = async (userId: number, rel: string): Promise<void> => {
  const cfg = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = cfg.getDataValue('storageType');
  if (storageType === 'local') return;

  const key = toNotesRemoteKey(userId, rel);

  if (storageType === 's3') {
    const s3Endpoint = cfg.getDataValue('s3Endpoint');
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3Region = cfg.getDataValue('s3Region');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;
    const safeEndpoint = s3Endpoint
      ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
      : undefined;
    const client = getS3Client({ s3Endpoint: safeEndpoint, s3Bucket, s3Region, s3AccessKeyEnc, s3SecretKeyEnc });
    const targets = [key, `${key}/.keep`];
    await Promise.all(
      targets.map((k) =>
        client
          .send(
            new DeleteObjectCommand({
              Bucket: s3Bucket,
              Key: k,
            })
          )
          .then(() => writeSyncLog({ ts: Date.now(), userId, action: 'delete', relPath: rel, remoteKey: k, ok: true }).catch(() => undefined))
          .catch((e: any) => writeSyncLog({ ts: Date.now(), userId, action: 'delete', relPath: rel, remoteKey: k, ok: false, error: e?.message || String(e) }).catch(() => undefined))
      )
    );
    return;
  }

  if (storageType === 'webdav') {
    const webdavUrl = cfg.getDataValue('webdavUrl');
    const webdavUsername = cfg.getDataValue('webdavUsername');
    const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
    if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;
    const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
    const client = createClient(safeUrl, {
      username: webdavUsername,
      password: decryptString(webdavPasswordEnc),
    });
    const remotePath = `/${key}`;
    await Promise.all(
      [remotePath, `${remotePath}/.keep`].map((p) =>
        client
          .deleteFile(p)
          .then(() => writeSyncLog({ ts: Date.now(), userId, action: 'delete', relPath: rel, remoteKey: p, ok: true }).catch(() => undefined))
          .catch((e: any) => writeSyncLog({ ts: Date.now(), userId, action: 'delete', relPath: rel, remoteKey: p, ok: false, error: e?.message || String(e) }).catch(() => undefined))
      )
    );
  }
};

export const syncAvatarToCloud = async (userId: number, avatarContent: Buffer, ext: string = 'png'): Promise<void> => {
  const cfg = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = cfg.getDataValue('storageType');
  if (storageType === 'local') return;

  const key = `${userId}/avatar.${ext}`;

  if (storageType === 's3') {
    const s3Endpoint = cfg.getDataValue('s3Endpoint');
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3Region = cfg.getDataValue('s3Region');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;

    const safeEndpoint = s3Endpoint
      ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
      : undefined;
    const client = getS3Client({ s3Endpoint: safeEndpoint, s3Bucket, s3Region, s3AccessKeyEnc, s3SecretKeyEnc });
    await client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: avatarContent,
        ContentType: `image/${ext}`,
      })
    );
    return;
  }

  if (storageType === 'webdav') {
    const webdavUrl = cfg.getDataValue('webdavUrl');
    const webdavUsername = cfg.getDataValue('webdavUsername');
    const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
    if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;

    const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
    const client = createClient(safeUrl, {
      username: webdavUsername,
      password: decryptString(webdavPasswordEnc),
    });
    const userDir = `/${userId}`;
    const remotePath = `${userDir}/avatar.${ext}`;
    try {
      await client.createDirectory(userDir);
    } catch {
    }
    await client.putFileContents(remotePath, avatarContent, { overwrite: true });
  }
};

export const syncImageToCloud = async (userId: number, imageContent: Buffer, filename: string): Promise<void> => {
  const cfg = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = cfg.getDataValue('storageType');
  if (storageType === 'local') return;

  const ext = filename.split('.').pop() || 'png';
  const key = `${userId}/images/${filename}`;

  if (storageType === 's3') {
    const s3Endpoint = cfg.getDataValue('s3Endpoint');
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3Region = cfg.getDataValue('s3Region');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;

    const safeEndpoint = s3Endpoint
      ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
      : undefined;
    const client = getS3Client({ s3Endpoint: safeEndpoint, s3Bucket, s3Region, s3AccessKeyEnc, s3SecretKeyEnc });
    await client.send(
      new PutObjectCommand({
        Bucket: s3Bucket,
        Key: key,
        Body: imageContent,
        ContentType: `image/${ext}`,
      })
    );
    return;
  }

  if (storageType === 'webdav') {
    const webdavUrl = cfg.getDataValue('webdavUrl');
    const webdavUsername = cfg.getDataValue('webdavUsername');
    const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
    if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;

    const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
    const client = createClient(safeUrl, {
      username: webdavUsername,
      password: decryptString(webdavPasswordEnc),
    });
    const userDir = `/${userId}`;
    const imagesDir = `${userDir}/images`;
    const remotePath = `${imagesDir}/${filename}`;
    try {
      if ((await client.exists(userDir)) === false) {
         await client.createDirectory(userDir);
      }
      if ((await client.exists(imagesDir)) === false) {
         await client.createDirectory(imagesDir);
      }
    } catch {
    }
    await client.putFileContents(remotePath, imageContent, { overwrite: true });
  }
};

export const deleteUserFromCloud = async (userId: number): Promise<void> => {
  const cfg = await StorageConfig.findOne({ where: { userId } });
  if (!cfg) return;
  const storageType = cfg.getDataValue('storageType');
  if (storageType === 'local') return;

  if (storageType === 's3') {
    const s3Endpoint = cfg.getDataValue('s3Endpoint');
    const s3Bucket = cfg.getDataValue('s3Bucket');
    const s3Region = cfg.getDataValue('s3Region');
    const s3AccessKeyEnc = cfg.getDataValue('s3AccessKeyEnc');
    const s3SecretKeyEnc = cfg.getDataValue('s3SecretKeyEnc');
    if (!s3Bucket || !s3AccessKeyEnc || !s3SecretKeyEnc) return;

    const safeEndpoint = s3Endpoint
      ? (await assertSafeRemoteUrl(s3Endpoint, { allowPrivate: allowPrivateStorageEndpoints })).toString()
      : undefined;
    const client = getS3Client({ s3Endpoint: safeEndpoint, s3Bucket, s3Region, s3AccessKeyEnc, s3SecretKeyEnc });
    const prefix = `${userId}/`;

    let token: string | undefined;
    const keys: string[] = [];
    for (;;) {
      const resp: any = await client.send(
        new ListObjectsV2Command({
          Bucket: s3Bucket,
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

    await Promise.all(
      keys.map((k) =>
        client
          .send(
            new DeleteObjectCommand({
              Bucket: s3Bucket,
              Key: k,
            })
          )
          .catch(() => undefined)
      )
    );
    return;
  }

  if (storageType === 'webdav') {
    const webdavUrl = cfg.getDataValue('webdavUrl');
    const webdavUsername = cfg.getDataValue('webdavUsername');
    const webdavPasswordEnc = cfg.getDataValue('webdavPasswordEnc');
    if (!webdavUrl || !webdavUsername || !webdavPasswordEnc) return;

    const safeUrl = (await assertSafeRemoteUrl(webdavUrl, { allowPrivate: allowPrivateStorageEndpoints })).toString();
    const client: any = createClient(safeUrl, {
      username: webdavUsername,
      password: decryptString(webdavPasswordEnc),
    });
    const userDir = `/${userId}`;

    try {
      const items = await client.getDirectoryContents(userDir, { deep: true }).catch(() => []);
      const paths: string[] = Array.isArray(items) ? items.map((i: any) => i?.filename).filter(Boolean) : [];
      paths.sort((a, b) => String(b).length - String(a).length);
      await Promise.all(paths.map((p) => client.deleteFile(p).catch(() => undefined)));
      await client.deleteFile(userDir).catch(() => undefined);
    } catch {
    }
  }
};
