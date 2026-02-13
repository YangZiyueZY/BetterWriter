import type { Sequelize } from 'sequelize';
import { QueryTypes } from 'sequelize';
import { migrations } from './index';

export const runMigrations = async (sequelize: Sequelize): Promise<void> => {
  await sequelize.query(
    'CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY, appliedAt INTEGER NOT NULL)'
  );

  const appliedRows = (await sequelize.query('SELECT id FROM migrations', {
    type: QueryTypes.SELECT,
  })) as Array<{ id: string }>;
  const applied = new Set(appliedRows.map((r) => r.id));

  for (const m of migrations) {
    if (applied.has(m.id)) continue;
    await m.up(sequelize);
    await sequelize.query('INSERT INTO migrations (id, appliedAt) VALUES (?, ?)', {
      replacements: [m.id, Date.now()],
    });
  }
};

