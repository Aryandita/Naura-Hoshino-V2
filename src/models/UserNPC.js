const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserNPC = sequelize.define('UserNPC', {
    userId: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    npcId: { type: DataTypes.STRING, allowNull: false, primaryKey: true },
    affection: { type: DataTypes.INTEGER, defaultValue: 0 },
    relationshipLevel: { type: DataTypes.INTEGER, defaultValue: 0 }, // 0: Kenalan, 1: Teman, 2: Sahabat, 3: Pacar, 4: Menikah (hanya untuk tipe romansa)
    lastInteraction: { type: DataTypes.DATE, allowNull: true },
    dailyGifts: { type: DataTypes.INTEGER, defaultValue: 0 }
}, {
    tableName: 'user_npcs',
    timestamps: false
});

module.exports = UserNPC;