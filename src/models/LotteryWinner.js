"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const LotteryWinner = sequelize.define(
  "LotteryWinner",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    winnerUserId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    prizeAmount: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    ticketsHeld: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    drawnAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "lottery_winners",
    timestamps: true,
  },
);

module.exports = LotteryWinner;
