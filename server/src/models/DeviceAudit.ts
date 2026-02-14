import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import User from './User';

class DeviceAudit extends Model {
  public id!: number;
  public userId!: number;
  public action!: string;
  public targetDeviceSessionId!: string | null;
  public ip!: string | null;
  public meta!: string | null;
  public createdAt!: number;
}

DeviceAudit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
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
    action: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    targetDeviceSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    ip: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    meta: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: () => Date.now(),
    },
  },
  {
    sequelize,
    tableName: 'device_audits',
    timestamps: false,
    indexes: [{ fields: ['userId'] }, { fields: ['createdAt'] }],
  }
);

User.hasMany(DeviceAudit, { foreignKey: 'userId', as: 'deviceAudits' });
DeviceAudit.belongsTo(User, { foreignKey: 'userId' });

export default DeviceAudit;

