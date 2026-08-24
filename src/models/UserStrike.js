const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserStrike = sequelize.define(
  "UserStrike",
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
    strikes: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isTempBanned: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    tempbanExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastStrikeAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "user_strikes",
    timestamps: true,
    indexes: [{ unique: true, fields: ["userId", "guildId"] }],
  },
);

module.exports = UserStrike;
