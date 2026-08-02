const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserCosmetic = sequelize.define('UserCosmetic', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    assetId: { type: DataTypes.INTEGER, allowNull: false },
    isActive: { type: DataTypes.BOOLEAN, defaultValue: false }
}, {
    tableName: 'user_cosmetics',
    timestamps: true
});

module.exports = UserCosmetic;
