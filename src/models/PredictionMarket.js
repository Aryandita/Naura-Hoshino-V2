"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const PredictionMarket = sequelize.define(
  "PredictionMarket",
  {
    marketId: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    guildId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    creatorId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING(32),
      defaultValue: "COMMUNITY", // COMMUNITY, ESPORTS, SURVIVAL, ANIME
    },
    options: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [
        { id: 1, label: "Ya", totalBet: 0, bettorCount: 0 },
        { id: 2, label: "Tidak", totalBet: 0, bettorCount: 0 },
      ],
    },
    totalPool: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "OPEN", // OPEN, LOCKED, RESOLVED, CANCELLED
    },
    winningOptionId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    lockTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    resolveTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    houseFeePercent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5, // 5% fee dialirkan ke World Boss Bounty Vault
    },
    maxBetPerUser: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10000,
    },
  },
  {
    tableName: "prediction_markets",
    timestamps: true,
    indexes: [
      { fields: ["guildId"] },
      { fields: ["status"] },
      { fields: ["lockTime"] },
    ],
  },
);

module.exports = PredictionMarket;
