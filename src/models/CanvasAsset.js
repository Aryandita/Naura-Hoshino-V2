const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const CanvasAsset = sequelize.define('CanvasAsset', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    name: { type: DataTypes.STRING, allowNull: false },
    type: { type: DataTypes.ENUM('background', 'border'), allowNull: false },
    url: { type: DataTypes.STRING, allowNull: false },
    price: { type: DataTypes.INTEGER, defaultValue: 0 },
    isPremiumOnly: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'canvas_assets',
    timestamps: true
});

module.exports = CanvasAsset;
