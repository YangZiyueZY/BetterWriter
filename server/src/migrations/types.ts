import type { Sequelize } from 'sequelize';

export type Migration = {
  id: string;
  up: (sequelize: Sequelize) => Promise<void>;
};

