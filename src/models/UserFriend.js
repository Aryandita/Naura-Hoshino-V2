const { DataTypes } = require('sequelize');
const { sequelize } = require('../managers/dbManager');

const UserFriend = sequelize.define('UserFriend', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    user1Id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    user2Id: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.ENUM('pending', 'accepted'),
        defaultValue: 'pending'
    },
    streak: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    lastInteraction: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    tableName: 'user_friends',
    timestamps: true
});

module.exports = UserFriend;
