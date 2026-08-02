const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserCrypto = sequelize.define('UserCrypto', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    coinId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    amount: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    },
    averageBuyPrice: {
        type: DataTypes.FLOAT,
        defaultValue: 0.0
    }
}, {
    tableName: 'user_crypto_portfolios',
    timestamps: true,
    indexes: [
        { unique: true, fields: ['userId', 'coinId'] }
    ]
});

module.exports = UserCrypto;
