const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserWarn = sequelize.define(
  "UserWarn",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    moderatorId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    reason: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    tableName: "user_warns",
    timestamps: true,
    indexes: [{ fields: ["guildId", "userId"] }],
  },
);

module.exports = UserWarn;
