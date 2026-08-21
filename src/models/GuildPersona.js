"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const GuildPersona = sequelize.define(
  "GuildPersona",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    personaId: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    guildId: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    channelId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    systemPrompt: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    voiceTone: {
      type: DataTypes.STRING(64),
      allowNull: false,
      defaultValue: "TSUNDERE", // TSUNDERE, CYBER_HACKER, ANCIENT_SAGE, BLACKSMITH, KUUDERE
    },
    avatarUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
  },
  {
    tableName: "guild_personas",
    timestamps: true,
  },
);

module.exports = GuildPersona;
