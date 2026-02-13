import { DataTypes } from 'sequelize';
import type { Migration } from './types';

export const migration002AddAvatar: Migration = {
  id: '002-add-avatar',
  up: async (sequelize) => {
    const queryInterface = sequelize.getQueryInterface();
    const tableInfo = await queryInterface.describeTable('users');
    if (!tableInfo['avatar']) {
      await queryInterface.addColumn('users', 'avatar', {
        type: DataTypes.STRING,
        allowNull: true,
      });
    }
  },
};
