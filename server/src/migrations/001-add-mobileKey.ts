import type { Migration } from './types';

export const migration001AddMobileKey: Migration = {
  id: '001-add-mobileKey',
  up: async (sequelize) => {
    await sequelize
      .query('ALTER TABLE users ADD COLUMN mobileKey VARCHAR(255)')
      .catch((err: any) => {
        const msg = String(err?.message || err);
        if (msg.includes('duplicate column name') || msg.includes('already exists')) return;
        throw err;
      });
  },
};

