import { Sequelize } from 'sequelize';
import path from 'path';

const storagePath = process.env.SQLITE_STORAGE_PATH || path.join(__dirname, '../../database.sqlite');

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: storagePath,
  logging: false,
});

export default sequelize;
