 import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import User from './User';

class File extends Model {
  public id!: string;
  public userId!: number;
  public parentId!: string | null;
  public name!: string;
  public type!: 'file' | 'folder';
  public content!: string;
  public format!: 'md' | 'txt';
}

File.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    parentId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING, // 'file' or 'folder'
      allowNull: false,
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: true, // folder has no content
    },
    format: {
      type: DataTypes.STRING, // 'md' or 'txt'
      allowNull: true, // folder has no format
    },
    // If error persists even after removing createdAt, it means existing DB schema has a DATE column
    // and Sequelize is confused because we are not defining it but maybe requesting it?
    // OR maybe another field is the issue?
    // Let's redefine ALL fields to match exactly what we send.
    // We send: id, userId, parentId, name, type, content, format, updatedAt
    // We do NOT send createdAt anymore.
    // But DB HAS createdAt column.
    // If we removed it from model, Sequelize ignores it on SELECT, but if we do `upsert` or `findOne`,
    // wait...
    // The error stack says `dialects/sqlite/data-types.js:54:17` in `parse`.
    // This happens when READING from DB.
    // So `findOne` or `upsert` (which does find) reads a value that it THINKS is a DATE but isn't string?
    // Or it IS a string but `parse` expects something else?
    // If we define column as DATE, Sequelize tries to parse.
    // If we DON'T define it, Sequelize shouldn't try to parse it unless `timestamps: true` adds it back.
    // We set `timestamps: false`.
    
    // WAIT. We might have other fields being DATE? No.
    // What if `updatedAt` was created as DATE in a previous migration?
    // We changed it to BIGINT now.
    // But if the column in SQLite is still DATE/DATETIME affinity, and we read it as BIGINT?
    // SQLite is loose typed.
    // If we store a number, it's a number.
    // BUT if Sequelize thinks it's a DATE (cached schema?), it calls parse.
    
    // Let's force `updatedAt` to be BIGINT explicitly and ensure we write numbers.
    // And ensure `createdAt` is gone.
    
    // It seems Sequelize still tries to parse something.
    // The only remaining suspicion is `updatedAt` even if defined as INTEGER, if the DB has garbage.
    // OR... `id` is STRING. `parentId` is STRING.
    // `content` is TEXT.
    // `type` is STRING. `format` is STRING.
    // `userId` is INTEGER.
    
    // What if we clear the DB? Since this is dev env.
    // Or drop the table?
    // We can use `force: true` in sync temporarily.
    
    updatedAt: {
      type: DataTypes.INTEGER, 
      allowNull: false,
      defaultValue: () => Date.now(),
    }
  },
  {
    sequelize,
    tableName: 'files',
    timestamps: false
  }
);

// Define association
User.hasMany(File, { foreignKey: 'userId', as: 'files' });
File.belongsTo(User, { foreignKey: 'userId' });

export default File;
