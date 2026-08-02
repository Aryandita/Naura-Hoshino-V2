const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserReminder = sequelize.define('UserReminder', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    userId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    channelId: {
        type: DataTypes.STRING,
        allowNull: false
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    remindAt: {
        type: DataTypes.DATE,
        allowNull: false
    },
    notified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    }
}, {
    tableName: 'user_reminders',
    timestamps: true
});

module.exports = UserReminder;
