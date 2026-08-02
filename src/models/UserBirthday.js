const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserBirthday = sequelize.define('UserBirthday', {
    userId: {
        type: DataTypes.STRING,
        primaryKey: true,
        allowNull: false
    },
    day: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    month: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    year: {
        type: DataTypes.INTEGER,
        allowNull: true // Optional
    },
    timezone: {
        type: DataTypes.STRING,
        defaultValue: 'Asia/Jakarta'
    }
}, {
    tableName: 'user_birthdays',
    timestamps: true
});

module.exports = UserBirthday;
