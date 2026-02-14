import type { Migration } from './types';

export const migration006CreateDeviceSessions: Migration = {
  id: '006-create-device-sessions',
  up: async (sequelize) => {
    await sequelize.query(
      "CREATE TABLE IF NOT EXISTS device_sessions (id VARCHAR(255) PRIMARY KEY, userId INTEGER NOT NULL, deviceKey VARCHAR(255) NOT NULL, deviceName VARCHAR(255) NOT NULL, deviceModel VARCHAR(255), deviceType VARCHAR(32) NOT NULL DEFAULT 'unknown', osInfo VARCHAR(255), lastLoginAt INTEGER NOT NULL, lastLoginIp VARCHAR(64), lastLoginLocation VARCHAR(255), issuedAt INTEGER NOT NULL, lastSeenAt INTEGER NOT NULL, revokedAt INTEGER, deletedAt INTEGER, undoUntil INTEGER, anomalous INTEGER NOT NULL DEFAULT 0, anomalyReason TEXT, createdAt INTEGER NOT NULL, updatedAt INTEGER NOT NULL)"
    );
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_device_sessions_userId ON device_sessions(userId)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_device_sessions_lastLoginAt ON device_sessions(lastLoginAt)');
    await sequelize.query('CREATE UNIQUE INDEX IF NOT EXISTS uniq_device_sessions_user_deviceKey ON device_sessions(userId, deviceKey)');
  },
};

