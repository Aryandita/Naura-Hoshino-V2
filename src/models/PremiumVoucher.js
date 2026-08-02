const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const PremiumVoucher = sequelize.define('PremiumVoucher', {
    code: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    durationDays: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 30
    },
    expiresAt: {
        type: DataTypes.DATE,
        allowNull: true // Jika null, berarti kode tidak pernah kedaluwarsa sebelum diredeem
    },
    isRedeemed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    redeemedBy: {
        type: DataTypes.STRING,
        allowNull: true
    },
    redeemedAt: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'premium_vouchers',
    timestamps: true
});

module.exports = PremiumVoucher;
