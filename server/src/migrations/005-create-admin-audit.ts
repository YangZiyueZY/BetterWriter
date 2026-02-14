import type { Migration } from './types';

export const migration005CreateAdminAudit: Migration = {
  id: '005-create-admin-audit',
  up: async (sequelize) => {
    await sequelize.query(
      'CREATE TABLE IF NOT EXISTS admin_audits (id INTEGER PRIMARY KEY AUTOINCREMENT, actorUserId INTEGER NOT NULL, action TEXT NOT NULL, targetUserId INTEGER, meta TEXT, createdAt INTEGER NOT NULL)'
    );
  },
};
