"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserStockHolding = sequelize.define(
  "UserStockHolding",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    ticker: {
      type: DataTypes.STRING(32),
      allowNull: false,
    },
    sharesOwned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    avgBuyPrice: {
      type: DataTypes.FLOAT,
      allowNull: false,
      defaultValue: 0.0,
    },
  },
  {
    tableName: "user_stock_holdings",
    timestamps: true,
    indexes: [{ fields: ["userId", "ticker"], unique: true }],
  },
);

module.exports = UserStockHolding;
