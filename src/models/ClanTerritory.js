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
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    clanId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    clanName: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
    controlPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    maxControlPoints: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    },
    defenseLevel: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    taxYield: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1000,
    },
    buffEffect: {
      type: DataTypes.STRING(128),
      allowNull: false,
      defaultValue: "EXTRA_GOLD_10",
    },
    contestedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastTaxClaimedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    contributingClanIds: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {}, // { clanId: accumulatedPoints }
    },
  },
  {
    tableName: "clan_territories",
    timestamps: true,
  },
);

module.exports = ClanTerritory;
