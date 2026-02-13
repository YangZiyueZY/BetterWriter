
export interface StorageItem {
  name: string;
  type: 'file' | 'folder';
  size: number;
  lastModified: Date;
}

export interface StorageAdapter {
  connect(config: any): Promise<boolean>;
  list(path: string): Promise<StorageItem[]>;
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  delete(path: string): Promise<void>;
  stat(path: string): Promise<StorageItem | null>;
}
