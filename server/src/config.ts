import dotenv from 'dotenv';
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
