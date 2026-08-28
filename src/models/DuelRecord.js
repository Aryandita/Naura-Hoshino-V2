const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");
const UserProfile = require("./UserProfile");

const DuelRecord = sequelize.define(
  "DuelRecord",
  {
    userId: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    mmr: {
      type: DataTypes.INTEGER,
      defaultValue: 1000,
      allowNull: false,
    },
    matchesPlayed: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    wins: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    losses: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    kills: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    deaths: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
  },
  {
    tableName: "duel_records",
    timestamps: true,
  },
);

DuelRecord.belongsTo(UserProfile, {
  foreignKey: "userId",
  onDelete: "CASCADE",
});
UserProfile.hasOne(DuelRecord, {
  foreignKey: "userId",
});

module.exports = DuelRecord;
