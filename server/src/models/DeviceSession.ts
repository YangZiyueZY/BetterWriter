import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import User from './User';

export type DeviceType = 'mobile' | 'tablet' | 'desktop' | 'unknown';

class DeviceSession extends Model {
  public id!: string;
  public userId!: number;
  public deviceKey!: string;
  public deviceName!: string;
  public deviceModel!: string | null;
  public deviceType!: DeviceType;
  public osInfo!: string | null;
  public lastLoginAt!: number;
  public lastLoginIp!: string | null;
  public lastLoginLocation!: string | null;
  public issuedAt!: number;
  public lastSeenAt!: number;
  public revokedAt!: number | null;
  public deletedAt!: number | null;
  public undoUntil!: number | null;
  public anomalous!: number;
  public anomalyReason!: string | null;
  public createdAt!: number;
  public updatedAt!: number;
}

DeviceSession.init(
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
    deviceKey: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deviceName: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    deviceModel: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    deviceType: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'unknown',
    },
    osInfo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Date.now(),
    },
    lastLoginIp: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastLoginLocation: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    issuedAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Date.now(),
    },
    lastSeenAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Date.now(),
    },
    revokedAt: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deletedAt: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    undoUntil: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    anomalous: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    anomalyReason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Date.now(),
    },
    updatedAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Date.now(),
    },
  },
  {
    sequelize,
    tableName: 'device_sessions',
    timestamps: false,
    indexes: [
      { fields: ['userId'] },
      { unique: true, fields: ['userId', 'deviceKey'] },
      { fields: ['lastLoginAt'] },
    ],
  }
);

User.hasMany(DeviceSession, { foreignKey: 'userId', as: 'deviceSessions' });
DeviceSession.belongsTo(User, { foreignKey: 'userId' });

export default DeviceSession;

