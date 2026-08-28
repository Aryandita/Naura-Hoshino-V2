"use strict";

/**
 * Model SeasonProgress
 *
 * Menyimpan progres Battle Pass / Sistem Musim pemain per season.
 * Satu baris per (userId, seasonId).
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SeasonProgress = sequelize.define(
  "SeasonProgress",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    seasonId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    xp: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    isPremiumPass: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    claimedTiersFree: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("claimedTiersFree");
        if (typeof raw === "string") {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
    },
    claimedTiersPremium: {
      type: DataTypes.JSON,
      defaultValue: [],
      get() {
        const raw = this.getDataValue("claimedTiersPremium");
        if (typeof raw === "string") {
          try {
            return JSON.parse(raw);
          } catch {
            return [];
          }
        }
        return Array.isArray(raw) ? raw : [];
      },
    },
  },
  {
    tableName: "season_progress",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["userId", "seasonId"],
        name: "uk_user_season",
      },
    ],
  },
);

module.exports = SeasonProgress;
