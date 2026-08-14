"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const WorldBoss = sequelize.define(
  "WorldBoss",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    bossId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "Ancient Calamity",
    },
    element: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "DARK",
    },
    maxHp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 1000000,
    },
    currentHp: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 1000000,
    },
    baseAttack: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 150,
    },
    defense: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 50,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "ACTIVE", // ACTIVE, DEFEATED, DESPAWNED, UPCOMING
    },
    damageLeaderboard: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {},
    },
    rewardsPool: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {
        starFragments: 5000,
        coupons: 50,
      },
    },
    spawnTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    tableName: "world_bosses",
    timestamps: true,
  },
);

module.exports = WorldBoss;
