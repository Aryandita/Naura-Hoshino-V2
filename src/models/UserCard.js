const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserCard = sequelize.define('UserCard', {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    userId: { type: DataTypes.STRING, allowNull: false },
    cardId: { type: DataTypes.STRING, allowNull: false },
    cardName: { type: DataTypes.STRING, allowNull: false },
    rarity: { type: DataTypes.STRING, allowNull: false },
    quantity: { type: DataTypes.INTEGER, defaultValue: 1 },
}, {
    tableName: 'user_cards',
    timestamps: true,
    indexes: [{ unique: true, fields: ['userId', 'cardId'] }]
});

module.exports = UserCard;
