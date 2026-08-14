const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserPet = sequelize.define("UserPet", {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  userId: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  petType: { type: DataTypes.STRING, allowNull: false }, // misal: 'wolf', 'cat', 'dragon'
  petName: { type: DataTypes.STRING, allowNull: true }, // Nama panggilan pet

  // --- TAMING SYSTEM ---
  isTamed: { type: DataTypes.BOOLEAN, defaultValue: false },
  tamingProgress: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0 - 100% untuk UI Bar

  // --- PET STATUS ---
  hunger: { type: DataTypes.INTEGER, defaultValue: 100 },
  affection: { type: DataTypes.INTEGER, defaultValue: 0 }, // Berapa dekat pet dengan user
  isActive: { type: DataTypes.BOOLEAN, defaultValue: false }, // Apakah pet ini sedang dipakai/dibawa
  petLevel: { type: DataTypes.INTEGER, defaultValue: 1 },
  petExp: { type: DataTypes.INTEGER, defaultValue: 0 },

  // --- ADVANCED SYSTEM ---
  mood: { type: DataTypes.STRING, defaultValue: "happy" }, // 'happy', 'normal', 'sad', 'angry'
  evolutionStage: { type: DataTypes.INTEGER, defaultValue: 1 },
  passiveSkill: { type: DataTypes.STRING, allowNull: true }, // e.g. "atk_up_1"
});

module.exports = UserPet;
