// src/models/UserChild.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserChild = sequelize.define('UserChild', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    motherNpcId: { type: DataTypes.STRING, allowNull: false }, // Siapa ibunya (Anya/Victoria/dll)
    name: { type: DataTypes.STRING, defaultValue: 'Si Kecil' },
    
    // --- STATS ANAK ---
    happiness: { type: DataTypes.INTEGER, defaultValue: 50 }, // 0 - 100
    hunger: { type: DataTypes.INTEGER, defaultValue: 50 },    // 0 - 100 (0 = Lapar banget)
    
    // --- GROWTH & BUFF ---
    level: { type: DataTypes.INTEGER, defaultValue: 1 }, // Semakin tinggi level, buff semakin besar
    xp: { type: DataTypes.INTEGER, defaultValue: 0 }
});

module.exports = UserChild;