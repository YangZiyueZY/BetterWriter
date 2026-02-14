import type { Migration } from './types';

export const migration004AddUserStatusLogin: Migration = {
  id: '004-add-user-status-login',
  up: async (sequelize) => {
    await sequelize
      .query("ALTER TABLE users ADD COLUMN status VARCHAR(32) NOT NULL DEFAULT 'active'")
      .catch((err: any) => {
        const msg = String(err?.message || err);
        if (msg.includes('duplicate column name') || msg.includes('already exists')) return;
        throw err;
      });

    await sequelize
      .query('ALTER TABLE users ADD COLUMN lastLoginAt INTEGER')
      .catch((err: any) => {
        const msg = String(err?.message || err);
        if (msg.includes('duplicate column name') || msg.includes('already exists')) return;
        throw err;
      });
  },
};
