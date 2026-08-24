"use strict";

const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserPet = sequelize.define("UserPet", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.STRING(191),
    allowNull: false,
  },
  petType: { type: DataTypes.STRING(64), allowNull: false }, // 'wolf', 'cat', 'dragon', 'phoenix', 'cosmic_kitsune'
  petName: { type: DataTypes.STRING(128), allowNull: true },

  // --- TAMING SYSTEM ---
  isTamed: { type: DataTypes.BOOLEAN, defaultValue: false },
  tamingProgress: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0 - 100%

  // --- PET STATUS ---
  hunger: { type: DataTypes.INTEGER, defaultValue: 100 },
  affection: { type: DataTypes.INTEGER, defaultValue: 0 },
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false },
  petLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
  petExp: { type: DataTypes.INTEGER, defaultValue: 0 },
  
  // --- ADVANCED & ASCENSION SYSTEM ---
  mood: { type: DataTypes.STRING(32), defaultValue: "happy" }, // 'happy', 'normal', 'sad', 'energized', 'ascended'
  evolutionStage: { type: DataTypes.INTEGER, defaultValue: 1 },
  passiveSkill: { type: DataTypes.STRING(128), allowNull: true },
  fusionCount: { type: DataTypes.INTEGER, defaultValue: 0 },
  cosmicAura: { type: DataTypes.BOOLEAN, defaultValue: false },
  habitatRoom: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: { toys: [], decorations: [], lastFedAt: null },
  },
});

module.exports = UserPet;
