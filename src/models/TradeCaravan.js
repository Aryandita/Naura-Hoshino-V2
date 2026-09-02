"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const TradeCaravan = sequelize.define(
  "TradeCaravan",
  {
    caravanId: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    guildId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    ownerClanId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    creatorUserId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    routeId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    cargo: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "EN_ROUTE", // EN_ROUTE, ARRIVED, AMBUSHED, CLAIMED
    },
    departureTime: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    estimatedArrival: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    totalInvestment: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    potentialYield: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "trade_caravans",
    timestamps: true,
  },
);

module.exports = TradeCaravan;
