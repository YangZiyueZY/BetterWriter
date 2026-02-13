import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import crypto from 'crypto';
import { writeFile } from 'fs/promises';
import sequelize from './db';
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import fileRoutes from './routes/files';
import storageRoutes from './routes/storage';
import uploadRoutes from './routes/upload';
import mobileRoutes from './routes/mobile';
import User from './models/User';
import File from './models/File';
import StorageConfig from './models/StorageConfig';
import bcrypt from 'bcryptjs';
import { runMigrations } from './migrations/runMigrations';

dotenv.config();

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3001;

// Security Middlewares
app.use(
  helmet({
    contentSecurityPolicy: process.env.NODE_ENV === 'production'
      ? {
          useDefaults: true,
          directives: {
            'upgrade-insecure-requests': null,
          },
        }
      : false,
    hsts: process.env.NODE_ENV === 'production',
  })
);
const corsOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (corsOrigins.length === 0) {
        return cb(null, process.env.NODE_ENV !== 'production');
      }
      return cb(null, corsOrigins.includes(origin));
    },
  })
);
app.use(express.json({ limit: '50mb' })); // Increase limit for file content
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate Limiting (auth only)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV !== 'production' ? 1000 : 200,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/auth', limiter);

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV !== 'production' ? 1000 : 300,
  message: 'Too many requests from this IP, please try again later.'
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/files', apiLimiter, fileRoutes);
app.use('/api/storage', apiLimiter, storageRoutes);
app.use('/api/upload', apiLimiter, uploadRoutes);
app.use('/api/mobile', mobileRoutes);

app.use(express.static(path.join(__dirname, '../../dist')));

app.get(/^(?!\/api).*/, (req, res, next) => {
  res.sendFile(path.join(__dirname, '../../dist/index.html'));
});

// Sync DB and Start Server
const startServer = async () => {
  try {
    await sequelize.sync();
    await runMigrations(sequelize);
    console.log('Database synced');

    const userCount = await User.count();
    if (userCount === 0) {
      const username = (process.env.ADMIN_USERNAME || 'admin').trim() || 'admin';
      const password =
        (process.env.ADMIN_PASSWORD && process.env.ADMIN_PASSWORD.trim()) ||
        crypto.randomBytes(24).toString('base64url').slice(0, 20);

      const hashedPassword = await bcrypt.hash(password, 10);
      await User.create({ username, password: hashedPassword });

      const adminCredsPath = path.join(__dirname, '..', '.admin-credentials');
      const content = `username=${username}\npassword=${password}\n`;
      try {
        await writeFile(adminCredsPath, content, { flag: 'wx' });
      } catch {}

      console.log(`Initial admin created: ${username}`);
      console.log(`Initial admin password: ${password}`);
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Database sync failed:', err);
  }
};

startServer();
