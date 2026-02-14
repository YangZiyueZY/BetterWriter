import dotenv from 'dotenv';
import { randomUUID } from 'crypto';
dotenv.config();

const getEnvOrThrow = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const JWT_SECRET: string = getEnvOrThrow('JWT_SECRET');
export const STORAGE_SECRET: string = getEnvOrThrow('STORAGE_SECRET');
export const ENABLE_MOBILE: boolean = (process.env.ENABLE_MOBILE || '').toLowerCase() === 'true';
export const SERVER_SESSION_ID: string = randomUUID();

const toInt = (v: any, fallback: number): number => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.floor(n) : fallback;
};

export const LOGIN_MAX_FAILED_ATTEMPTS: number = Math.max(1, toInt(process.env.LOGIN_MAX_FAILED_ATTEMPTS, 5));
export const LOGIN_FAIL_WINDOW_MS: number = Math.max(5_000, toInt(process.env.LOGIN_FAIL_WINDOW_MS, 10 * 60 * 1000));
export const LOGIN_BAN_MS: number = Math.max(5_000, toInt(process.env.LOGIN_BAN_MS, 15 * 60 * 1000));

export const MAX_ACTIVE_DEVICES_PER_ACCOUNT: number = Math.max(1, toInt(process.env.MAX_ACTIVE_DEVICES_PER_ACCOUNT, 5));
