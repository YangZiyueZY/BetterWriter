import type { Migration } from './types';

export const migration008CreateDeviceAudits: Migration = {
  id: '008-create-device-audits',
  up: async (sequelize) => {
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS device_audits (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, action VARCHAR(64) NOT NULL, targetDeviceSessionId VARCHAR(255), ip VARCHAR(64), meta TEXT, createdAt INTEGER NOT NULL)'
    );
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_device_audits_userId ON device_audits(userId)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_device_audits_createdAt ON device_audits(createdAt)');
  },
};

