"use strict";

/**
 * Model SemanticMemory
 *
 * Menyimpan memori jangka panjang pengguna dan pengetahuan server berbasis vektor semantik.
 * Digunakan oleh Living AI (Gemini 2.0) untuk konteks percakapan personal dan Server RAG.
 */

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const SemanticMemory = sequelize.define(
  "SemanticMemory",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    userId: {
      type: DataTypes.STRING(191),
      allowNull: false,
    },
    guildId: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    memoryType: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "USER_FACT",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    embedding: {
      type: DataTypes.TEXT,
      allowNull: true,
      get() {
        const raw = this.getDataValue("embedding");
        if (!raw) return null;
        try {
          return typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          return null;
        }
      },
      set(val) {
        if (val === null || val === undefined) {
          this.setDataValue("embedding", null);
        } else {
          this.setDataValue(
            "embedding",
            typeof val === "string" ? val : JSON.stringify(val),
          );
        }
      },
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
    },
  },
  {
    tableName: "semantic_memories",
    timestamps: true,
    indexes: [
      { fields: ["userId"] },
      { fields: ["guildId"] },
      { fields: ["memoryType"] },
    ],
  },
);

module.exports = SemanticMemory;
