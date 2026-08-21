"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const PredictionBet = sequelize.define(
  "PredictionBet",
  {
    betId: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    marketId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    username: {
      type: DataTypes.STRING(128),
      allowNull: false,
      defaultValue: "Anonymous",
    },
    optionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    amount: {
      type: DataTypes.BIGINT,
      allowNull: false,
    },
    payout: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "PENDING", // PENDING, WON, LOST, REFUNDED
    },
  },
  {
    tableName: "prediction_bets",
    timestamps: true,
    indexes: [
      { fields: ["marketId"] },
      { fields: ["userId"] },
      { fields: ["guildId", "userId"] },
    ],
  },
);

module.exports = PredictionBet;
