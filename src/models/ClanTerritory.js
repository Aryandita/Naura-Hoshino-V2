"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ClanTerritory = sequelize.define(
  "ClanTerritory",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    territoryId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    clanId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    controlPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    taxYield: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    },
    buffEffect: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: "EXTRA_GOLD_10",
    },
    contestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "clan_territories",
    timestamps: true,
  },
);

module.exports = ClanTerritory;
