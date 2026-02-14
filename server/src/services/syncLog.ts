import { mkdir, appendFile } from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

type SyncLogEntry = {
  ts: number;
  userId: number;
  action: string;
  relPath?: string;
  remoteKey?: string;
  ok: boolean;
  attempt?: number;
  hash?: string;
  error?: string;
};

const logDir = path.join(process.cwd(), 'logs');
const logFile = path.join(logDir, 'cloud-sync.jsonl');

export const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');

export const writeSyncLog = async (e: SyncLogEntry) => {
  await mkdir(logDir, { recursive: true });
  await appendFile(logFile, `${JSON.stringify(e)}\n`, 'utf8');
};

