const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserQuest = sequelize.define(
  "UserQuest",
  {
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    lastReset: {
      type: DataTypes.DATEONLY, // Tanggal kapan terakhir kali direset (YYYY-MM-DD)
      allowNull: false,
    },
    workCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    dungeonKills: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    collectCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    isClaimed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    questsState: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    tableName: "user_quests",
    timestamps: true,
  },
);

module.exports = UserQuest;
