"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const ColiseumTeam = sequelize.define(
  "ColiseumTeam",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    userId: {
      type: DataTypes.STRING(191),
      allowNull: false,
      unique: true,
    },
    teamName: {
      type: DataTypes.STRING(128),
      allowNull: false,
      defaultValue: "Vanguard Squad",
    },
    formation: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [], // [{ id, name, type, atk, def, hp }]
    },
    eloRating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1200,
    },
    divisionTier: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "BRONZE", // BRONZE, SILVER, GOLD, PLATINUM, DIAMOND, MASTER
    },
    wins: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    losses: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastFoughtAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "coliseum_teams",
    timestamps: true,
  },
);

module.exports = ColiseumTeam;
