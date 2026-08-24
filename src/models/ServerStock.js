"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ServerStock = sequelize.define(
  "ServerStock",
  {
    ticker: {
      type: DataTypes.STRING(32),
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    clanId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    currentPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 100.0,
    },
    previousPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 100.0,
    },
    totalShares: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10000,
    },
    availableShares: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10000,
    },
    dividendYield: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.05, // 5% dividen
    },
    history24h: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [], // [{ timestamp, open, high, low, close }]
    },
    isHighRisk: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
  },
  {
    tableName: "server_stocks",
    timestamps: true,
  },
);

module.exports = ServerStock;
