import type { Migration } from './types';

export const migration007CreateSecurityAlerts: Migration = {
  id: '007-create-security-alerts',
  up: async (sequelize) => {
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS security_alerts (id VARCHAR(255) PRIMARY KEY, userId INTEGER NOT NULL, type VARCHAR(64) NOT NULL, title VARCHAR(255) NOT NULL, message TEXT NOT NULL, meta TEXT, createdAt INTEGER NOT NULL, readAt INTEGER)'
    );
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_security_alerts_userId ON security_alerts(userId)');
    await sequelize.query('CREATE INDEX IF NOT EXISTS idx_security_alerts_createdAt ON security_alerts(createdAt)');
  },
};

