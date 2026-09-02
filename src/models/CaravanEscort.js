"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const CaravanEscort = sequelize.define(
  "CaravanEscort",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    caravanId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    userId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    combatPower: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
    },
    profitSharePercent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
    },
  },
  {
    tableName: "caravan_escorts",
    timestamps: true,
  },
);

module.exports = CaravanEscort;
