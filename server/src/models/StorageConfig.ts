import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import User from './User';

class StorageConfig extends Model {
  public userId!: number;
  public storageType!: 'local' | 's3' | 'webdav';
  public s3Endpoint!: string | null;
  public s3Bucket!: string | null;
  public s3Region!: string | null;
  public s3AccessKeyEnc!: string | null;
  public s3SecretKeyEnc!: string | null;
  public webdavUrl!: string | null;
  public webdavUsername!: string | null;
  public webdavPasswordEnc!: string | null;
}

StorageConfig.init(
  {
    userId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    storageType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'local',
    },
    s3Endpoint: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    s3Bucket: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    s3Region: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    s3AccessKeyEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    s3SecretKeyEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    webdavUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webdavUsername: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    webdavPasswordEnc: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'storage_configs',
    timestamps: false,
  }
);

User.hasOne(StorageConfig, { foreignKey: 'userId', as: 'storageConfig' });
StorageConfig.belongsTo(User, { foreignKey: 'userId' });

export default StorageConfig;
