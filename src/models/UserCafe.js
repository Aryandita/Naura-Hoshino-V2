"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserCafe = sequelize.define(
  "UserCafe",
  {
    userId: {
      type: DataTypes.STRING(32),
      primaryKey: true,
    },
    cafeName: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "Cyber Maid Lounge",
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    reputation: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    unlockedRecipes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: ["sakura_latte", "cyber_ramen"],
    },
    activeDishes: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: {}, // { recipeId: count }
    },
    theme: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "CYBER_NEON", // CYBER_NEON, MAID_CLASSIC, SAKURA_ZEN
    },
    customersServed: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    uncollectedRevenue: {
      type: DataTypes.BIGINT,
      allowNull: false,
      defaultValue: 0,
    },
    lastCollectedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "user_cafes",
    timestamps: true,
  },
);

module.exports = UserCafe;
