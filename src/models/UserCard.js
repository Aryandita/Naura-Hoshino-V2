const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/database");

const UserCard = sequelize.define(
  "UserCard",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    cardCode: { type: DataTypes.STRING(32), unique: true, allowNull: true },
    userId: { type: DataTypes.STRING(191), allowNull: false },
    cardId: { type: DataTypes.STRING(128), allowNull: false },
    cardName: { type: DataTypes.STRING(255), allowNull: false },
    characterName: { type: DataTypes.STRING(255), allowNull: true },
    seriesName: { type: DataTypes.STRING(255), allowNull: true },
    rarity: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "RARE" },
    printNumber: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    quality: { type: DataTypes.STRING(32), allowNull: false, defaultValue: "GOOD" }, // POOR, GOOD, EXCELLENT, GEM_MINT
    frame: { type: DataTypes.STRING(64), allowNull: false, defaultValue: "DEFAULT" }, // DEFAULT, HOLO, CYBER, GOLD, VOID
    dyeColor: { type: DataTypes.STRING(32), allowNull: true },
    imageUrl: { type: DataTypes.TEXT, allowNull: true },
    isLocked: { type: DataTypes.BOOLEAN, defaultValue: false },
    burnValue: { type: DataTypes.INTEGER, defaultValue: 100 },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
  },
  {
    tableName: "user_cards",
    timestamps: true,
  },
);

module.exports = UserCard;

