
import { S3Client, ListObjectsV2Command, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import type { StorageAdapter, StorageItem } from './index';
import type { S3Config } from '../../types';
import { decryptData } from '../../lib/security';

export class S3Adapter implements StorageAdapter {
  private client: S3Client | null = null;
  private bucket: string = '';

  async connect(config: S3Config): Promise<boolean> {
    try {
      // If keys are encrypted (contain ':'), decrypt them
      // Assuming 'betterwriter-master-key' is temporarily used or user provided
      // In real implementation, this key comes from user session/input
      // For now, we assume config might be plain text OR encrypted.
      // NOTE: This is a simplification. Real app needs secure key management.
      
      const accessKeyId = config.accessKey.includes(':') 
        ? await decryptData(config.accessKey, 'betterwriter-master-key') // Placeholder secret
        : config.accessKey;
        
      const secretAccessKey = config.secretKey.includes(':')
        ? await decryptData(config.secretKey, 'betterwriter-master-key')
        : config.secretKey;

      if (!accessKeyId || !secretAccessKey) return false;

      this.client = new S3Client({
        region: config.region,
        endpoint: config.endpoint,
        credentials: {
          accessKeyId,
          secretAccessKey
        },
        forcePathStyle: true // Needed for MinIO/compatible services
      });
      
      this.bucket = config.bucket;
      
      // Test connection
      await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, MaxKeys: 1 }));
      return true;
    } catch (e) {
      console.error('S3 Connection Failed:', e);
      return false;
    }
  }

  async list(path: string): Promise<StorageItem[]> {
    if (!this.client) throw new Error('S3 Client not connected');
    
    // Ensure path ends with / for folder listing context
    const prefix = path === '/' ? '' : (path.endsWith('/') ? path : `${path}/`);

    const command = new ListObjectsV2Command({
      Bucket: this.bucket,
      Prefix: prefix,
      Delimiter: '/'
    });

    const response = await this.client.send(command);
    const items: StorageItem[] = [];

    // Folders (CommonPrefixes)
    response.CommonPrefixes?.forEach(p => {
      if (p.Prefix) {
        items.push({
          name: p.Prefix.replace(prefix, '').replace('/', ''),
          type: 'folder',
          size: 0,
          lastModified: new Date()
        });
      }
    });

    // Files (Contents)
    response.Contents?.forEach(c => {
      if (c.Key && c.Key !== prefix) {
        items.push({
          name: c.Key.replace(prefix, ''),
          type: 'file',
          size: c.Size || 0,
          lastModified: c.LastModified || new Date()
        });
      }
    });

    return items;
  }

  async read(path: string): Promise<string> {
    if (!this.client) throw new Error('S3 Client not connected');
    
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: path
    });

    const response = await this.client.send(command);
    return response.Body?.transformToString() || '';
  }

  async write(path: string, content: string): Promise<void> {
    if (!this.client) throw new Error('S3 Client not connected');

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: path,
      Body: content,
      ContentType: 'text/plain' // Or adjust based on extension
    });

    await this.client.send(command);
  }

  async delete(path: string): Promise<void> {
    if (!this.client) throw new Error('S3 Client not connected');

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: path
    });

    await this.client.send(command);
  }

  async stat(path: string): Promise<StorageItem | null> {
    if (!this.client) throw new Error('S3 Client not connected');

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: path
      });
      const response = await this.client.send(command);
      
      return {
        name: path.split('/').pop() || path,
        type: 'file',
        size: response.ContentLength || 0,
        lastModified: response.LastModified || new Date()
      };
    } catch {
      return null;
    }
  }
}
