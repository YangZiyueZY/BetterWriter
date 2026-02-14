import type { Migration } from './types';

export const migration003AddTokenVersion: Migration = {
  id: '003-add-tokenVersion',
  up: async (sequelize) => {
    await sequelize
      .query('ALTER TABLE users ADD COLUMN tokenVersion INTEGER DEFAULT 0')
      .catch((err: any) => {
        const msg = String(err?.message || err);
        if (msg.includes('duplicate column name') || msg.includes('already exists')) return;
        throw err;
      });
  },
};
