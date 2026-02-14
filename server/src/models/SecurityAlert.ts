import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import User from './User';

class SecurityAlert extends Model {
  public id!: string;
  public userId!: number;
  public type!: string;
  public title!: string;
  public message!: string;
  public meta!: string | null;
  public createdAt!: number;
  public readAt!: number | null;
}

SecurityAlert.init(
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
    type: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
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
    readAt: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'security_alerts',
    timestamps: false,
    indexes: [{ fields: ['userId'] }, { fields: ['createdAt'] }],
  }
);

User.hasMany(SecurityAlert, { foreignKey: 'userId', as: 'securityAlerts' });
SecurityAlert.belongsTo(User, { foreignKey: 'userId' });

export default SecurityAlert;

