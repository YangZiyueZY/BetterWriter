
import { createClient } from 'webdav';
import type { WebDAVClient, FileStat } from 'webdav';
import type { StorageAdapter, StorageItem } from './index';
import type { WebDAVConfig } from '../../types';
import { decryptData } from '../../lib/security';

export class WebDAVAdapter implements StorageAdapter {
  private client: WebDAVClient | null = null;

  async connect(config: WebDAVConfig): Promise<boolean> {
    try {
      const rawUrl = (config.url || '').trim();
      if (!rawUrl) return false;

      let parsedUrl: URL;
      try {
        parsedUrl = new URL(rawUrl);
      } catch {
        return false;
      }

      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
        return false;
      }

      const password = config.password.includes(':')
        ? await decryptData(config.password, 'betterwriter-master-key')
        : config.password;

      if (!password) return false;

      this.client = createClient(parsedUrl.toString(), {
        username: config.username,
        password: password
      });

      // Test connection
      await this.client.getDirectoryContents('/');
      return true;
    } catch (e) {
      console.error('WebDAV Connection Failed:', e);
      return false;
    }
  }

  async list(path: string): Promise<StorageItem[]> {
    if (!this.client) throw new Error('WebDAV Client not connected');

    const contents = await this.client.getDirectoryContents(path) as FileStat[];
    
    return contents.map(item => ({
      name: item.basename,
      type: item.type === 'directory' ? 'folder' : 'file',
      size: item.size,
      lastModified: new Date(item.lastmod)
    }));
  }

  async read(path: string): Promise<string> {
    if (!this.client) throw new Error('WebDAV Client not connected');
    
    const content = await this.client.getFileContents(path, { format: 'text' });
    return content as string;
  }

  async write(path: string, content: string): Promise<void> {
    if (!this.client) throw new Error('WebDAV Client not connected');
    
    await this.client.putFileContents(path, content);
  }

  async delete(path: string): Promise<void> {
    if (!this.client) throw new Error('WebDAV Client not connected');
    
    await this.client.deleteFile(path);
  }

  async stat(path: string): Promise<StorageItem | null> {
    if (!this.client) throw new Error('WebDAV Client not connected');

    try {
      const stat = await this.client.stat(path) as FileStat;
      return {
        name: stat.basename,
        type: stat.type === 'directory' ? 'folder' : 'file',
        size: stat.size,
        lastModified: new Date(stat.lastmod)
      };
    } catch {
      return null;
    }
  }
}
