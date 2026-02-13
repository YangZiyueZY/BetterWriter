import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from 'webdav';
import StorageConfig from '../models/StorageConfig';
import { decryptString } from '../lib/crypto';
import { assertSafeRemoteUrl } from '../lib/ssrf';

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

  if (file.type === 'folder') return;
  const ext = file.format || 'txt';
  const key = `${userId}/${file.id}.${ext}`;
  const content = file.content || '';

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
        Body: content,
        ContentType: 'text/plain; charset=utf-8',
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
    const remotePath = `${userDir}/${file.id}.${ext}`;
    try {
      await client.createDirectory(userDir);
    } catch {
    }
    await client.putFileContents(remotePath, content, { overwrite: true });
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
