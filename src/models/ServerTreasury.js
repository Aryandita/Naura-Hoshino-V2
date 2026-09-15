"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ServerTreasury = sequelize.define(
  "ServerTreasury",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    lotteryJackpot: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    noviceAidPool: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    wanderingMerchantPool: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    lastLotteryDrawAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "server_treasuries",
    timestamps: true,
  },
);

module.exports = ServerTreasury;
