import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';
import User from './User';

class AdminAudit extends Model {
  public id!: number;
  public actorUserId!: number;
  public action!: string;
  public targetUserId!: number | null;
  public meta!: string | null;
  public createdAt!: number;
}

AdminAudit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    actorUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: 'id',
      },
    },
    action: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    targetUserId: {
      type: DataTypes.INTEGER,
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
    tableName: 'admin_audits',
    timestamps: false,
  }
);

User.hasMany(AdminAudit, { foreignKey: 'actorUserId', as: 'adminAudits' });
AdminAudit.belongsTo(User, { foreignKey: 'actorUserId', as: 'actor' });

export default AdminAudit;
