const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const GameItem = sequelize.define('GameItem', {
    id: { type: DataTypes.STRING, primaryKey: true },
    name: { type: DataTypes.STRING, allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    price: { type: DataTypes.INTEGER, defaultValue: 0 },
    sellPrice: { type: DataTypes.INTEGER, defaultValue: 0 },
    category: { type: DataTypes.STRING, defaultValue: 'material' },
    rarity: { type: DataTypes.STRING, defaultValue: 'Biasa' },

    // JSON to handle flexible attributes like 'effects', 'targetPet', 'upgrade_level', 'base_efficiency', 'base_damage', 'stat', 'boost'
    attributes: {
        type: DataTypes.JSON,
        defaultValue: {}
    }
}, {
    tableName: 'game_items',
    timestamps: false
});

module.exports = GameItem;
