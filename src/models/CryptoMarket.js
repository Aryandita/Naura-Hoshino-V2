const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const CryptoMarket = sequelize.define('CryptoMarket', {
    coinId: {
        type: DataTypes.STRING,
        primaryKey: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    currentPrice: {
        type: DataTypes.FLOAT,
        defaultValue: 100.0
    },
    previousPrice: {
        type: DataTypes.FLOAT,
        defaultValue: 100.0
    },
    history: {
        type: DataTypes.JSON, // Simpan histori 24 jam terakhir
        defaultValue: []
    }
}, {
    tableName: 'crypto_market',
    timestamps: false
});

module.exports = CryptoMarket;
