import { DataTypes, Model } from 'sequelize';
import sequelize from '../db';

class User extends Model {
  public id!: number;
  public username!: string;
  public password!: string;
  public mobileKey!: string | null;
  public avatar!: string | null;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    mobileKey: {
      type: DataTypes.STRING,
      allowNull: true,
      // unique: true // SQLite limitation on ALTER TABLE
    },
    avatar: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'users',
  }
);

export default User;
