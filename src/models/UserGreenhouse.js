"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserGreenhouse = sequelize.define(
  "UserGreenhouse",
  {
    userId: {
      type: DataTypes.STRING(191),
      primaryKey: true,
    },
    gridLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    slots: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
    },
    totalHarvests: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "user_greenhouses",
    timestamps: true,
  },
);

module.exports = UserGreenhouse;
