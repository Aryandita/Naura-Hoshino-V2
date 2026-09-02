"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CommunityDungeon = sequelize.define(
  "CommunityDungeon",
  {
    dungeonId: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    creatorUserId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    dungeonName: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    theme: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "CYBER_VOID", // CYBER_VOID, VOLCANIC_CORE, ASTRAL_TEMPLE, NEON_CRYPT
    },
    roomsConfig: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    entryFee: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 100,
    },
    vaultBalance: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    ratingAverage: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 5.0,
    },
    totalPlays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    totalClears: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "community_dungeons",
    timestamps: true,
  },
);

module.exports = CommunityDungeon;
