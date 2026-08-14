"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const MinecraftLink = sequelize.define(
  "MinecraftLink",
  {
    userId: {
      type: DataTypes.STRING(32),
      primaryKey: true,
      allowNull: false,
    },
    mcUsername: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    mcUuid: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    isVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    verificationCode: {
      type: DataTypes.STRING(16),
      allowNull: true,
    },
    totalSyncRewards: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    tableName: "minecraft_links",
    timestamps: true,
    indexes: [
      {
        name: "idx_minecraft_links_userId",
        fields: ["userId"],
      },
      {
        name: "idx_minecraft_links_mcUsername",
        fields: ["mcUsername"],
      },
    ],
  },
);

module.exports = MinecraftLink;
