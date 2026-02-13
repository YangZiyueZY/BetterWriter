export interface FileItem {
  id: string;
  parentId: string | null;
  name: string;
  type: 'file';
  content: string;
  format: 'txt' | 'md';
  createdAt: number;
  updatedAt: number;
}

export interface FolderItem {
  id: string;
  parentId: string | null;
  name: string;
  type: 'folder';
  createdAt: number;
  updatedAt: number;
}

export type FileSystemItem = FileItem | FolderItem;

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface S3Config {
  endpoint: string;
  bucket: string;
  accessKey: string;
  secretKey: string;
  region: string;
}

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
}

export interface User {
  id: number;
  username: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
}

export interface Settings {
  // Storage & Sync
  storageType: 'local' | 's3' | 'webdav';
  s3Config?: S3Config;
  webDavConfig?: WebDAVConfig;

  // Appearance (General)
  backgroundImage?: string;
  backgroundColor?: string;
  darkMode?: boolean;
  fontFamily?: string;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  codeBlockTheme?: string;
}
